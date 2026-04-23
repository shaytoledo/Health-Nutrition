/**
 * screens/FoodScanScreen.js
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ScrollView, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

let CameraView = null;
let useCameraPermissions = null;
if (Platform.OS !== 'web') {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

import { useApp } from '../context/AppContext';
import { useThemeColors } from '../context/ThemeContext';
import { analyzeFood, analyzeFoodByName } from '../services/geminiService';
import MacroProgressBar from '../components/MacroProgressBar';
import ThemeToggle from '../components/ThemeToggle';

let WebCamera = null;
if (Platform.OS === 'web') {
  WebCamera = require('../components/WebCamera').default;
}

const SCAN_STATE = {
  IDLE: 'idle', CAMERA: 'camera', ANALYZING: 'analyzing',
  RESULT: 'result', MANUAL: 'manual', BY_NAME: 'by_name', LOGGING: 'logging',
};

export default function FoodScanScreen() {
  const { currentUser, logMeal } = useApp();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const uid = currentUser?.uid;

  const [scanState, setScanState]             = useState(SCAN_STATE.IDLE);
  const [selectedImage, setSelectedImage]     = useState(null);
  const [imageSource, setImageSource]         = useState(null);
  const [imageMime, setImageMime]             = useState('image/jpeg');
  const [nutritionResult, setNutritionResult] = useState(null);
  const [error, setError]                     = useState(null);
  const [showWebCam, setShowWebCam]           = useState(false);
  const cameraRef = useRef(null);

  const permHook = useCameraPermissions ? useCameraPermissions() : [{ granted: false }, async () => ({ granted: false })];
  const [cameraPermission, requestCameraPermission] = permHook;

  const [manualForm, setManualForm] = useState({ description: '', calories: '', proteinG: '', carbsG: '', fatG: '' });
  const [byNameForm, setByNameForm] = useState({ foodName: '', grams: '' });

  const handleByNameAnalyze = async () => {
    const name = byNameForm.foodName.trim();
    const grams = Number(byNameForm.grams);
    if (!name) { Alert.alert('שגיאה', 'אנא הכנס שם מזון.'); return; }
    if (!grams || grams <= 0) { Alert.alert('שגיאה', 'אנא הכנס משקל בגרמים.'); return; }
    setError(null); setScanState(SCAN_STATE.ANALYZING); setSelectedImage(null);
    try {
      const nutrition = await analyzeFoodByName(name, grams);
      setNutritionResult(nutrition); setScanState(SCAN_STATE.RESULT);
    } catch (err) {
      if (err.code === 'FOOD_NOT_RECOGNIZED') { Alert.alert('לא זוהה מזון', 'ה-AI לא הצליח לזהות את המזון. נסה שם אחר או הזן ידנית.'); setScanState(SCAN_STATE.BY_NAME); return; }
      setError(err.message || 'שגיאה בחישוב התזונה.'); setScanState(SCAN_STATE.BY_NAME);
    }
  };

  const openCamera = () => {
    if (Platform.OS === 'web') { setShowWebCam(true); return; }
    requestCameraPermission().then((result) => {
      if (result.granted) setScanState(SCAN_STATE.CAMERA);
      else Alert.alert('הרשאת מצלמה נדרשת', 'אנא אפשר גישה למצלמה בהגדרות.');
    });
  };

  const openGallery = async () => {
    if (Platform.OS === 'web') { triggerFileInput(false); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('הרשאת גלריה נדרשת', 'אנא אפשר גישה לספריית התמונות.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: false });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0].uri, result.assets[0].uri, 'image/jpeg');
  };

  function triggerFileInput(withCapture) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (withCapture) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', (e) => {
      document.body.removeChild(input);
      const file = e.target.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      handleImageSelected(uri, file, file.type || 'image/jpeg');
    });
    window.addEventListener('focus', function cleanup() {
      window.removeEventListener('focus', cleanup);
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 1000);
    });
    input.click();
  }

  async function handleImageSelected(uri, source, mime) {
    setSelectedImage({ uri }); setImageSource(source); setImageMime(mime); setError(null); setScanState(SCAN_STATE.ANALYZING);
    try {
      const nutrition = await analyzeFood(source, mime);
      setNutritionResult(nutrition); setScanState(SCAN_STATE.RESULT);
    } catch (err) {
      if (err.code === 'FOOD_NOT_RECOGNIZED') {
        Alert.alert('לא זוהה מזון', 'ה-AI לא הצליח לזהות מזון בתמונה.', [
          { text: 'צלם שנית', onPress: () => setScanState(SCAN_STATE.IDLE) },
          { text: 'הזנה ידנית', onPress: () => setScanState(SCAN_STATE.MANUAL) },
        ]);
        return;
      }
      setError(err.message || 'שגיאה בניתוח התמונה.'); setScanState(SCAN_STATE.IDLE);
    }
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setScanState(SCAN_STATE.IDLE); handleImageSelected(photo.uri, photo.uri, 'image/jpeg');
    } catch { Alert.alert('שגיאה', 'לא ניתן לצלם. נסה שנית.'); setScanState(SCAN_STATE.IDLE); }
  };

  const handleConfirmLog = () => {
    if (!nutritionResult || !uid) return;
    logMeal(uid, nutritionResult);
    const name = nutritionResult.description;
    setScanState(SCAN_STATE.IDLE); setSelectedImage(null); setNutritionResult(null);
    Alert.alert('✅ נרשם בהצלחה!', `"${name}" נוסף ליומן.`, [{ text: 'מעולה 👍' }]);
  };

  const handleManualLog = () => {
    if (!manualForm.description.trim()) { Alert.alert('שגיאה', 'אנא הכנס שם מזון.'); return; }
    if (!uid) return;
    const mealData = { description: manualForm.description.trim(), calories: Number(manualForm.calories) || 0, proteinG: Number(manualForm.proteinG) || 0, carbsG: Number(manualForm.carbsG) || 0, fatG: Number(manualForm.fatG) || 0 };
    logMeal(uid, mealData);
    const name = mealData.description;
    setManualForm({ description: '', calories: '', proteinG: '', carbsG: '', fatG: '' });
    setScanState(SCAN_STATE.IDLE);
    Alert.alert('✅ נרשם בהצלחה!', `"${name}" נוסף ליומן.`, [{ text: 'מעולה 👍' }]);
  };

  if (showWebCam && Platform.OS === 'web' && WebCamera) {
    return <WebCamera onCapture={({ uri, file, mimeType }) => { setShowWebCam(false); handleImageSelected(uri, file, mimeType); }} onCancel={() => setShowWebCam(false)} />;
  }

  if (scanState === SCAN_STATE.CAMERA && Platform.OS !== 'web' && CameraView) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setScanState(SCAN_STATE.IDLE)}>
              <Text style={styles.cancelCameraTxt}>✕ ביטול</Text>
            </TouchableOpacity>
            <View style={styles.focusFrame} />
            <Text style={styles.cameraHint}>כוון את המצלמה לאוכל וצלם</Text>
            <TouchableOpacity style={styles.shutterBtn} onPress={takePicture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.screenHeader}>
            <ThemeToggle />
            <Text style={styles.screenTitle}>רישום ארוחה</Text>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          )}

          {scanState === SCAN_STATE.IDLE && (
            <View style={styles.actionSection}>
              <TouchableOpacity style={styles.primaryButton} onPress={openCamera}>
                <Text style={styles.primaryButtonText}>📷  צלם עכשיו</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={openGallery}>
                <Text style={styles.secondaryButtonText}>🖼  בחר מהגלריה</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanState(SCAN_STATE.BY_NAME)}>
                <Text style={styles.secondaryButtonText}>⚖️  הוסף לפי שם ומשקל</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => setScanState(SCAN_STATE.MANUAL)}>
                <Text style={styles.outlineButtonText}>✏  הזנה ידנית</Text>
              </TouchableOpacity>
            </View>
          )}

          {scanState === SCAN_STATE.BY_NAME && (
            <View style={styles.manualForm}>
              <Text style={styles.formTitle}>הוספה לפי שם ומשקל</Text>
              <Text style={styles.hintText}>ה-AI יחשב את הערכים התזונתיים בהתאם לגרמים</Text>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>שם המזון</Text>
                <TextInput style={styles.formInput} placeholder="המבורגר / סלט / אורז לבן" placeholderTextColor={c.placeholder} value={byNameForm.foodName} textAlign="right" onChangeText={(v) => setByNameForm((f) => ({ ...f, foodName: v }))} />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>משקל (גרמים)</Text>
                <TextInput style={styles.formInput} placeholder="200" placeholderTextColor={c.placeholder} keyboardType="numeric" value={byNameForm.grams} textAlign="right" onChangeText={(v) => setByNameForm((f) => ({ ...f, grams: v }))} />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleByNameAnalyze}>
                <Text style={styles.primaryButtonText}>🤖  חשב ערכים תזונתיים</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => setScanState(SCAN_STATE.IDLE)}>
                <Text style={styles.outlineButtonText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          )}

          {scanState === SCAN_STATE.ANALYZING && (
            <View style={styles.centerBox}>
              {selectedImage && <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />}
              <ActivityIndicator size="large" color={c.mint} style={{ marginTop: 24 }} />
              <Text style={styles.statusText}>ה-AI מנתח את האוכל שלך...</Text>
            </View>
          )}

          {scanState === SCAN_STATE.RESULT && nutritionResult && (
            <View style={styles.resultContainer}>
              {selectedImage && <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />}
              <Text style={styles.resultTitle}>{nutritionResult.description}</Text>
              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionCardTitle}>הערכה תזונתית</Text>
                <MacroProgressBar label="קלוריות" consumed={nutritionResult.calories} target={nutritionResult.calories} unit="קק״ל" color={c.orange} showBar={false} />
                <MacroProgressBar label="חלבון"   consumed={nutritionResult.proteinG} target={nutritionResult.proteinG} unit="גר׳"  color={c.coral}  showBar={false} />
                <MacroProgressBar label="פחמימות" consumed={nutritionResult.carbsG}   target={nutritionResult.carbsG}   unit="גר׳"  color={c.yellow} showBar={false} />
                <MacroProgressBar label="שומן"    consumed={nutritionResult.fatG}     target={nutritionResult.fatG}     unit="גר׳"  color={c.mint}   showBar={false} />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmLog}>
                <Text style={styles.primaryButtonText}>✓  הוסף ליומן</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => { setScanState(SCAN_STATE.IDLE); setSelectedImage(null); }}>
                <Text style={styles.outlineButtonText}>בטל</Text>
              </TouchableOpacity>
            </View>
          )}

          {scanState === SCAN_STATE.MANUAL && (
            <View style={styles.manualForm}>
              <Text style={styles.formTitle}>הזנה ידנית</Text>
              {[
                { key: 'description', label: 'שם המזון',       placeholder: 'חזה עוף בגריל', keyboard: 'default' },
                { key: 'calories',    label: 'קלוריות (קק״ל)', placeholder: '0',              keyboard: 'numeric' },
                { key: 'proteinG',    label: 'חלבון (גר׳)',     placeholder: '0',              keyboard: 'numeric' },
                { key: 'carbsG',      label: 'פחמימות (גר׳)',   placeholder: '0',              keyboard: 'numeric' },
                { key: 'fatG',        label: 'שומן (גר׳)',      placeholder: '0',              keyboard: 'numeric' },
              ].map(({ key, label, placeholder, keyboard }) => (
                <View key={key} style={styles.formRow}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput style={styles.formInput} placeholder={placeholder} placeholderTextColor={c.placeholder}
                    keyboardType={keyboard} value={manualForm[key]} textAlign="right"
                    onChangeText={(v) => setManualForm((f) => ({ ...f, [key]: v }))} />
                </View>
              ))}
              <TouchableOpacity style={styles.primaryButton} onPress={handleManualLog}>
                <Text style={styles.primaryButtonText}>הוסף ליומן</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => setScanState(SCAN_STATE.IDLE)}>
                <Text style={styles.outlineButtonText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          )}

          {scanState === SCAN_STATE.LOGGING && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={c.mint} />
              <Text style={styles.statusText}>שומר ארוחה...</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container:          { flex: 1, backgroundColor: c.bg },
    screenHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
    screenTitle:        { fontSize: 28, fontWeight: '800', color: c.text, textAlign: 'right', letterSpacing: -0.5 },
    errorBanner:        { backgroundColor: c.errorBg, marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.errorBorder },
    errorText:          { color: c.errorText, fontSize: 13, textAlign: 'right' },
    actionSection:      { marginHorizontal: 20, gap: 12 },
    primaryButton:      { backgroundColor: c.mint, borderRadius: 18, paddingVertical: 17, alignItems: 'center', marginBottom: 8 },
    primaryButtonText:  { color: c.mintText, fontSize: 16, fontWeight: '800' },
    secondaryButton:    { backgroundColor: c.surface, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: c.border },
    secondaryButtonText:{ color: c.text, fontSize: 16, fontWeight: '700' },
    outlineButton:      { borderWidth: 1.5, borderColor: c.mint, borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 8, backgroundColor: c.mintDim },
    outlineButtonText:  { color: c.mint, fontSize: 16, fontWeight: '700' },
    centerBox:          { alignItems: 'center', paddingVertical: 40 },
    previewImage:       { width: '100%', height: 220, borderRadius: 20 },
    statusText:         { marginTop: 16, fontSize: 15, color: c.textSec, fontWeight: '500' },
    resultContainer:    { marginHorizontal: 20 },
    resultTitle:        { fontSize: 22, fontWeight: '800', color: c.text, marginVertical: 12, textAlign: 'right' },
    nutritionCard:      { backgroundColor: c.surface, borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: c.border },
    nutritionCardTitle: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 16, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 },
    manualForm:         { marginHorizontal: 20 },
    formTitle:          { fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 20, textAlign: 'right' },
    formRow:            { marginBottom: 14 },
    formLabel:          { fontSize: 13, fontWeight: '600', color: c.textSec, marginBottom: 6, textAlign: 'right' },
    hintText:           { fontSize: 13, color: c.textMuted, marginBottom: 16, textAlign: 'right' },
    formInput:          { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: c.inputBorder, textAlign: 'right', color: c.text },
    cameraContainer:    { flex: 1 },
    camera:             { flex: 1 },
    cameraOverlay:      { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 50 },
    cancelCameraBtn:    { alignSelf: 'flex-end', marginRight: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    cancelCameraTxt:    { color: '#FFF', fontSize: 15, fontWeight: '700' },
    focusFrame:         { width: 240, height: 240, borderWidth: 2, borderColor: c.mint, borderRadius: 24 },
    cameraHint:         { color: '#FFF', fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 },
    shutterBtn:         { width: 76, height: 76, borderRadius: 38, backgroundColor: c.mintDim, borderWidth: 3, borderColor: c.mint, alignItems: 'center', justifyContent: 'center' },
    shutterInner:       { width: 58, height: 58, borderRadius: 29, backgroundColor: c.mint },
  });
}
