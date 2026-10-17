import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

const C = {
  bg: '#080910',
  panel: '#11121b',
  border: '#242535',
  text: '#F6F5FA',
  muted: '#9292A8',
  purple: '#9B71FF',
};

const STORAGE_KEYS = 'nobili.keys';
const STORAGE_HIST = 'nobili.hist';

export default function App() {
  const [tab, setTab] = useState('create');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [openai, setOpenai] = useState('');
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const rawKeys = await AsyncStorage.getItem(STORAGE_KEYS);
        const keys = JSON.parse(rawKeys || '{}');
        setOpenai(keys.openai || '');
        setDraft(keys.openai || '');

        const rawHist = await AsyncStorage.getItem(STORAGE_HIST);
        setItems(JSON.parse(rawHist || '[]'));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const saveKeys = async () => {
    const value = draft.trim();
    await AsyncStorage.setItem(STORAGE_KEYS, JSON.stringify({ openai: value }));
    setOpenai(value);
    Alert.alert('OK', 'Clé enregistrée uniquement sur cet appareil.');
  };

  const generate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Prompt', 'Écrivez une description.');
      return;
    }
    if (!openai.trim()) {
      Alert.alert('Clé manquante', 'Allez dans Clés et collez votre OPENAI_API_KEY.');
      setTab('keys');
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + openai.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.trim(),
          size: '1024x1024',
          n: 1,
          response_format: 'b64_json',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error((data.error && data.error.message) || 'HTTP ' + res.status);
      }

      const b64 = data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) {
        throw new Error("Aucune image renvoyée par l'API.");
      }

      const uri = 'data:image/png;base64,' + b64;
      const entry = {
        id: String(Date.now()),
        title: prompt.trim().slice(0, 40),
        uri,
        createdAt: new Date().toISOString(),
      };

      const next = [entry, ...items].slice(0, 50);
      setItems(next);
      setResult(entry);
      await AsyncStorage.setItem(STORAGE_HIST, JSON.stringify(next));
      setPrompt('');
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Échec de la génération');
    } finally {
      setBusy(false);
    }
  };

  const importImg = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', "Autorisez l'accès à la galerie.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (res.canceled || !res.assets || !res.assets[0]) {
      return;
    }

    const entry = {
      id: String(Date.now()),
      title: 'Import',
      uri: res.assets[0].uri,
      createdAt: new Date().toISOString(),
    };

    const next = [entry, ...items].slice(0, 50);
    setItems(next);
    setResult(entry);
    await AsyncStorage.setItem(STORAGE_HIST, JSON.stringify(next));
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.brand}>
          NOBILI <Text style={{ color: C.purple }}>IA</Text>
        </Text>
        <Text style={styles.sub}>Studio créatif · SDK 57</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'create' && (
          <View>
            <Text style={styles.h1}>Texte → Image</Text>
            <Text style={styles.p}>OpenAI DALL·E 3 · clé stockée sur l'appareil</Text>

            <Pressable onPress={importImg} style={styles.secondary}>
              <Text style={styles.secondaryText}>Importer une image</Text>
            </Pressable>

            <Text style={styles.label}>PROMPT</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Décrivez votre image…"
              placeholderTextColor={C.muted}
              value={prompt}
              onChangeText={setPrompt}
            />

            <Pressable
              onPress={generate}
              disabled={busy}
              style={[styles.btn, busy && { opacity: 0.7 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Générer l'image</Text>
              )}
            </Pressable>

            {result && result.uri ? (
              <View style={styles.card}>
                <Text style={styles.label}>RÉSULTAT</Text>
                <Image source={{ uri: result.uri }} style={styles.img} />
              </View>
            ) : null}
          </View>
        )}

        {tab === 'keys' && (
          <View>
            <Text style={styles.h1}>Clés API</Text>
            <Text style={styles.p}>
              La clé reste uniquement sur cet appareil (AsyncStorage). Ne la
              partagez pas.
            </Text>

            <Text style={styles.label}>OPENAI_API_KEY</Text>
            <TextInput
              style={styles.inputSingle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="sk-..."
              placeholderTextColor={C.muted}
              value={draft}
              onChangeText={setDraft}
            />

            <Pressable onPress={saveKeys} style={styles.btn}>
              <Text style={styles.btnText}>Enregistrer</Text>
            </Pressable>
          </View>
        )}

        {tab === 'gallery' && (
          <View>
            <Text style={styles.h1}>Galerie ({items.length})</Text>
            {items.length === 0 ? (
              <Text style={styles.p}>Aucune création pour le moment.</Text>
            ) : (
              items.map((x) => (
                <View key={x.id} style={styles.card}>
                  <Image source={{ uri: x.uri }} style={styles.thumb} />
                  <Text style={styles.cardTitle}>{x.title}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.nav}>
        <Pressable onPress={() => setTab('create')} style={styles.navItem}>
          <Text style={[styles.navText, tab === 'create' && styles.navOn]}>
            Créer
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab('gallery')} style={styles.navItem}>
          <Text style={[styles.navText, tab === 'gallery' && styles.navOn]}>
            Galerie
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab('keys')} style={styles.navItem}>
          <Text style={[styles.navText, tab === 'keys' && styles.navOn]}>
            Clés
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
  },
  sub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  scroll: {
    padding: 18,
    paddingBottom: 100,
  },
  h1: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
  },
  p: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 14,
    lineHeight: 18,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    minHeight: 100,
    borderRadius: 14,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    color: C.text,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  inputSingle: {
    height: 48,
    borderRadius: 14,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    color: C.text,
    marginBottom: 12,
  },
  btn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondary: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#534075',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  secondaryText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
  },
  img: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    marginTop: 8,
  },
  thumb: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  cardTitle: {
    color: C.text,
    fontWeight: '700',
    marginTop: 8,
    fontSize: 12,
  },
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: '#0E0F17',
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    padding: 12,
  },
  navText: {
    color: C.muted,
    fontWeight: '600',
    fontSize: 12,
  },
  navOn: {
    color: C.text,
  },
});
