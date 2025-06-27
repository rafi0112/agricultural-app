import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './AuthContext';
import SafeScreen from './SafeScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MapScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { shopId, readOnly, initialLocation } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState({
    latitude: 23.8103,
    longitude: 90.4125,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Fetch existing location and get current location
  useEffect(() => {
    (async () => {
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required');
          return;
        }

        // Get current location
        const currentLocation = await Location.getCurrentPositionAsync({});
        
        // If we have a shopId, try to fetch existing location
        if (shopId) {
          const shopDoc = await getDoc(doc(db, 'shops', shopId));
          if (shopDoc.exists() && shopDoc.data().location) {
            const shopLocation = shopDoc.data().location;
            setLocation(prev => ({
              ...prev,
              latitude: shopLocation.latitude,
              longitude: shopLocation.longitude,
            }));
          } else {
            // Use current location if no saved location
            setLocation(prev => ({
              ...prev,
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }));
          }
        }
      } catch (error) {
        console.error('Error initializing location:', error);
        Alert.alert('Error', 'Failed to get location');
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId]);

  // If in read-only mode and we have an initial location, use it
  useEffect(() => {
    if (readOnly && initialLocation) {
      setLocation({
        ...location,
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      });
    }
  }, [readOnly, initialLocation]);

  const handleSaveLocation = async () => {
    try {
      if (!shopId || !currentUser?.uid) {
        Alert.alert('Error', 'Shop ID is required');
        return;
      }

      const shopRef = doc(db, 'shops', shopId);
      
      // Check if shop exists and belongs to current user
      const shopDoc = await getDoc(shopRef);
      if (!shopDoc.exists()) {
        Alert.alert('Error', 'Shop not found');
        return;
      }

      if (shopDoc.data().farmerId !== currentUser.uid) {
        Alert.alert('Error', 'You do not have permission to update this shop');
        return;
      }

      // Update shop location
      await setDoc(shopRef, {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        lastUpdated: new Date(),
      }, { merge: true });

      Alert.alert(
        'Success', 
        'Shop location updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to update shop location');
    }
  };

  if (loading) {
    return (
      <SafeScreen style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.safeArea}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={location}
          onRegionChange={!readOnly ? setLocation : undefined}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Shop Location"
            description={readOnly ? "Shop's saved location" : "Drag map to adjust location"}
            pinColor="#059669"
          />
        </MapView>
        
        {!readOnly && (
          <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveLocation}
            >
              <Text style={styles.saveButtonText}>Save Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  saveButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

export default MapScreen;