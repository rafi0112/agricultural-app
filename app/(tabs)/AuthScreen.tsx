import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  Easing
} from 'react-native';
import { useAuth } from './AuthContext';
import { Feather, MaterialIcons } from '@expo/vector-icons';

const AuthScreen = () => {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleAuthMode = () => {
    Animated.timing(animation, {
      toValue: isRegistering ? 0 : 1,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    setIsRegistering(!isRegistering);
  };

  const handleAuth = async () => {
    if (!email || !password || (isRegistering && !name)) {
      alert('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <View style={styles.appIcon}>
          <Feather name="shopping-cart" size={48} color="#4CAF50" />
        </View>
        <Text style={styles.title}>{isRegistering ? 'Create Account' : 'Welcome Back'}</Text>
      </View>

      <Animated.View 
        style={[
          styles.inputContainer,
          { transform: [{ translateY }] }
        ]}
      >
        {isRegistering && (
          <View style={styles.inputWrapper}>
            <Feather name="user" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCapitalize="words"
              placeholderTextColor="#999"
            />
          </View>
        )}

        <View style={styles.inputWrapper}>
          <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholderTextColor="#999"
          />
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
          >
            <Feather 
              name={showPassword ? "eye-off" : "eye"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.authButton}
          onPress={handleAuth}
          disabled={isLoading}
        >
          <Text style={styles.authButtonText}>
            {isLoading ? 'Processing...' : isRegistering ? 'Sign Up' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity }}>
          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={() => alert('Password reset link sent to your email')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}
        </Text>
        <TouchableOpacity onPress={toggleAuthMode}>
          <Text style={styles.footerLink}>
            {isRegistering ? ' Sign In' : ' Sign Up'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.socialAuthContainer}>
        <Text style={styles.socialAuthText}>Or continue with</Text>
        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton}>
            <Feather name="github" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Feather name="twitter" size={24} color="#1DA1F2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Feather name="facebook" size={24} color="#4267B2" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#333',
    fontSize: 16,
  },
  passwordToggle: {
    padding: 8,
  },
  authButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotPasswordText: {
    color: '#666',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  footerLink: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  socialAuthContainer: {
    alignItems: 'center',
  },
  socialAuthText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
});

export default AuthScreen;