import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Alert,
  TouchableOpacity, Image, RefreshControl, ActivityIndicator,
  Share, Modal, ScrollView
} from 'react-native';
import { blogsCol, auth } from './firebaseConfig';
import { addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment';

export default function BlogsScreen() {
  const [blogs, setBlogs] = useState([]);
  const [newBlog, setNewBlog] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = () => {
    setRefreshing(true);
    const q = query(blogsCol, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBlogs(snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data())
      })));
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  };

  const postBlog = async () => {
    if (!newBlog.title || !newBlog.content) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    try {
      await addDoc(blogsCol, {
        title: newBlog.title,
        content: newBlog.content,
        authorId: auth.currentUser?.uid || 'unknown',
        authorName: auth.currentUser?.displayName || 'Anonymous Farmer',
        createdAt: new Date()
      });
      setNewBlog({ title: '', content: '' });
      Alert.alert('Success', 'Blog posted successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to post blog');
    }
  };

  const deleteBlog = async (blogId, authorId) => {
    if (authorId !== auth.currentUser?.uid) {
      Alert.alert('Error', 'You can only delete your own blogs');
      return;
    }
    try {
      await deleteDoc(doc(blogsCol, blogId));
      Alert.alert('Success', 'Blog deleted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete blog');
    }
  };

  const onRefresh = () => {
    fetchBlogs();
  };

  const onShare = async (title, content) => {
    try {
      await Share.share({ message: `${title}\n\n${content}`, title: 'Check out this blog!' });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading blogs...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={blogs}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Community Blogs</Text>
              <Feather name="rss" size={24} color="#4CAF50" />
            </View>
            <View style={styles.blogForm}>
              <Text style={styles.formTitle}>Create New Post</Text>
              <View style={styles.inputContainer}>
                <Feather name="edit-2" size={20} color="#7F7F7F" style={styles.inputIcon} />
                <TextInput
                  placeholder="Blog Title"
                  value={newBlog.title}
                  onChangeText={text => setNewBlog({ ...newBlog, title: text })}
                  style={styles.input}
                />
              </View>
              <View style={styles.inputContainer}>
                <MaterialIcons name="description" size={20} color="#7F7F7F" style={styles.inputIcon} />
                <TextInput
                  placeholder="Share your farming experience..."
                  value={newBlog.content}
                  onChangeText={text => setNewBlog({ ...newBlog, content: text })}
                  style={[styles.input, { height: 100 }]}
                  multiline
                />
              </View>
              <TouchableOpacity style={styles.postButton} onPress={postBlog}>
                <Text style={styles.postButtonText}>Publish Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.blogCard}>
            <View style={styles.blogHeader}>
              <Image
                source={{ uri: `https://ui-avatars.com/api/?name=${item.authorName}&background=4CAF50&color=fff` }}
                style={styles.avatar}
              />
              <View style={styles.blogAuthorInfo}>
                <Text style={styles.blogAuthor}>{item.authorName}</Text>
                <Text style={styles.blogDate}>{moment(item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt).fromNow()}</Text>
              </View>
              {item.authorId === auth.currentUser?.uid && (
                <TouchableOpacity onPress={() => deleteBlog(item.id, item.authorId)}>
                  <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.blogTitle}>{item.title}</Text>
            <Text numberOfLines={3} style={styles.blogContent}>{item.content}</Text>
            <TouchableOpacity onPress={() => { setSelectedBlog(item); setShowModal(true); }}>
              <Text style={styles.readMoreText}>Read More</Text>
            </TouchableOpacity>
            <View style={styles.blogFooter}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="heart-outline" size={20} color="#7F7F7F" />
                <Text style={styles.actionText}>Like</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item.title, item.content)}>
                <Ionicons name="share-social-outline" size={20} color="#7F7F7F" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {selectedBlog && (
        <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <ScrollView style={styles.modalContentWrapper}>
              <Text style={styles.modalTitle}>{selectedBlog.title}</Text>
              <Text style={styles.modalAuthor}>by {selectedBlog.authorName}</Text>
              <Text style={styles.modalContent}>{selectedBlog.content}</Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: '#4CAF50' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  blogForm: { padding: 16, backgroundColor: '#fff', margin: 16, borderRadius: 8 },
  formTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10 },
  input: { flex: 1, fontSize: 16, padding: 10 },
  postButton: { backgroundColor: '#4CAF50', borderRadius: 8, padding: 14, alignItems: 'center' },
  postButtonText: { color: '#fff', fontWeight: 'bold' },
  blogCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8 },
  blogHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  blogAuthorInfo: { flex: 1 },
  blogAuthor: { fontWeight: 'bold', color: '#333' },
  blogDate: { fontSize: 12, color: '#aaa' },
  blogTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  blogContent: { fontSize: 14, color: '#555' },
  readMoreText: { color: '#4CAF50', marginTop: 8, fontWeight: 'bold' },
  blogFooter: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#eee', marginTop: 10, paddingTop: 10 },
  actionButton: { flexDirection: 'row', alignItems: 'center' },
  actionText: { marginLeft: 6, color: '#7F7F7F', fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalCloseButton: { alignItems: 'flex-end', padding: 16 },
  modalContentWrapper: { flex: 1, padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  modalAuthor: { fontSize: 14, color: '#888', marginBottom: 20 },
  modalContent: { fontSize: 16, lineHeight: 24 },
});