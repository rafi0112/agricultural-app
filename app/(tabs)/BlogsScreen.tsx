import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Alert,
  TouchableOpacity, Image, RefreshControl, ActivityIndicator,
  Share, Modal, ScrollView, Animated, Dimensions
} from 'react-native';
import { blogsCol, auth } from './firebaseConfig';
import { addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment';

// TypeScript interfaces
interface Blog {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any; // Firebase Timestamp or Date
}

interface NewBlog {
  title: string;
  content: string;
}

export default function BlogsScreen() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [newBlog, setNewBlog] = useState<NewBlog>({ title: '', content: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = () => {
    setRefreshing(true);
    const q = query(blogsCol, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBlogs(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Blog)));
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

  const deleteBlog = async (blogId: string, authorId: string) => {
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

  const onShare = async (title: string, content: string) => {
    try {
      await Share.share({ message: `${title}\n\n${content}`, title: 'Check out this blog!' });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading blogs...</Text>
      </SafeAreaView>
    );
  }

  const AnimatedBlogCard = ({ children, index }: { children: React.ReactNode; index: number }) => {
    const cardFadeAnim = React.useRef(new Animated.Value(0)).current;
    const cardTranslateY = React.useRef(new Animated.Value(50)).current;

    React.useEffect(() => {
      Animated.parallel([
        Animated.timing(cardFadeAnim, {
          toValue: 1,
          duration: 600,
          delay: index * 100,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 600,
          delay: index * 100,
          useNativeDriver: true,
        })
      ]).start();
    }, []);

    return (
      <Animated.View
        style={{
          opacity: cardFadeAnim,
          transform: [{ translateY: cardTranslateY }],
        }}
      >
        {children}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={blogs}
        keyExtractor={(item: Blog) => item.id}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#059669']}
            tintColor="#059669"
          />
        }
        ListHeaderComponent={
          <View>
            {/* Modern Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Community Blogs</Text>
                <Text style={styles.headerSubtitle}>Share your farming insights</Text>
              </View>
              <View style={styles.headerIcon}>
                <MaterialIcons name="article" size={28} color="#059669" />
              </View>
            </View>

            {/* Modern Blog Form */}
            <View style={styles.blogForm}>
              <View style={styles.formHeader}>
                <MaterialIcons name="edit" size={24} color="#059669" />
                <Text style={styles.formTitle}>Create New Post</Text>
              </View>
              
              <View style={styles.inputContainer}>
                <Feather name="edit-2" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  placeholder="What's your farming story?"
                  value={newBlog.title}
                  onChangeText={(text: string) => setNewBlog({ ...newBlog, title: text })}
                  style={styles.input}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <MaterialIcons name="description" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Share your farming experience, tips, and insights with the community..."
                  value={newBlog.content}
                  onChangeText={(text: string) => setNewBlog({ ...newBlog, content: text })}
                  style={[styles.input, styles.textArea]}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              
              <TouchableOpacity style={styles.postButton} onPress={postBlog}>
                <MaterialIcons name="publish" size={20} color="#FFFFFF" />
                <Text style={styles.postButtonText}>Publish Post</Text>
              </TouchableOpacity>
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest Posts</Text>
              <Text style={styles.sectionSubtitle}>{blogs.length} posts from farmers</Text>
            </View>
          </View>
        }
        renderItem={({ item, index }: { item: Blog; index: number }) => (
          <AnimatedBlogCard index={index}>
            <View style={styles.blogCard}>
              {/* Blog Header */}
              <View style={styles.blogHeader}>
                <Image
                  source={{ uri: `https://ui-avatars.com/api/?name=${item.authorName}&background=059669&color=fff&size=80` }}
                  style={styles.avatar}
                />
                <View style={styles.blogAuthorInfo}>
                  <Text style={styles.blogAuthor}>{item.authorName}</Text>
                  <Text style={styles.blogDate}>
                    {moment(item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt).fromNow()}
                  </Text>
                </View>
                {item.authorId === auth.currentUser?.uid && (
                  <TouchableOpacity 
                    onPress={() => deleteBlog(item.id, item.authorId)}
                    style={styles.deleteButton}
                  >
                    <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Blog Content */}
              <Text style={styles.blogTitle}>{item.title}</Text>
              <Text numberOfLines={3} style={styles.blogContent}>{item.content}</Text>
              
              <TouchableOpacity 
                onPress={() => { setSelectedBlog(item); setShowModal(true); }}
                style={styles.readMoreButton}
              >
                <Text style={styles.readMoreText}>Read More</Text>
                <Feather name="arrow-right" size={16} color="#059669" />
              </TouchableOpacity>

              {/* Blog Footer */}
              <View style={styles.blogFooter}>
                <TouchableOpacity style={styles.actionButton}>
                  <MaterialIcons name="favorite-border" size={18} color="#64748B" />
                  <Text style={styles.actionText}>Like</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => onShare(item.title, item.content)}
                >
                  <MaterialIcons name="share" size={18} color="#64748B" />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <MaterialIcons name="bookmark-border" size={18} color="#64748B" />
                  <Text style={styles.actionText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedBlogCard>
        )}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={styles.footerSpacer} />}
      />

      {/* Modern Modal */}
      {selectedBlog && (
        <Modal 
          visible={showModal} 
          animationType="slide" 
          onRequestClose={() => setShowModal(false)}
          presentationStyle="formSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setShowModal(false)} 
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalShareButton}
                onPress={() => onShare(selectedBlog.title, selectedBlog.content)}
              >
                <MaterialIcons name="share" size={20} color="#059669" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContentWrapper} showsVerticalScrollIndicator={false}>
              <View style={styles.modalAuthorSection}>
                <Image
                  source={{ uri: `https://ui-avatars.com/api/?name=${selectedBlog.authorName}&background=059669&color=fff&size=120` }}
                  style={styles.modalAvatar}
                />
                <View style={styles.modalAuthorInfo}>
                  <Text style={styles.modalAuthorName}>{selectedBlog.authorName}</Text>
                  <Text style={styles.modalDate}>
                    {moment(selectedBlog.createdAt.toDate ? selectedBlog.createdAt.toDate() : selectedBlog.createdAt).format('MMMM Do, YYYY • h:mm A')}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.modalTitle}>{selectedBlog.title}</Text>
              <Text style={styles.modalContent}>{selectedBlog.content}</Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F1F5F9',
    paddingTop: 50,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: { 
    marginTop: 16, 
    color: '#059669',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 32,
  },
  footerSpacer: {
    height: 100,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blogForm: { 
    padding: 24, 
    backgroundColor: '#FFFFFF', 
    marginHorizontal: 20, 
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginLeft: 12,
    color: '#1E293B',
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 16, 
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: { 
    flex: 1, 
    fontSize: 16, 
    padding: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  postButton: { 
    backgroundColor: '#059669', 
    borderRadius: 16, 
    padding: 16, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  postButtonText: { 
    color: '#FFFFFF', 
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  blogCard: { 
    backgroundColor: '#FFFFFF', 
    marginHorizontal: 20, 
    marginBottom: 16, 
    padding: 20, 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  blogHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  blogAuthorInfo: { 
    flex: 1,
  },
  blogAuthor: { 
    fontWeight: '700', 
    color: '#1E293B',
    fontSize: 16,
  },
  blogDate: { 
    fontSize: 12, 
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  blogTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 12, 
    color: '#1E293B',
    lineHeight: 24,
  },
  blogContent: { 
    fontSize: 15, 
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  readMoreText: { 
    color: '#059669', 
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  blogFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9', 
    paddingTop: 16,
  },
  actionButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  actionText: { 
    marginLeft: 6, 
    color: '#64748B', 
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseButton: { 
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  modalShareButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
  },
  modalContentWrapper: { 
    flex: 1, 
    padding: 24,
  },
  modalAuthorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  modalAuthorInfo: {
    flex: 1,
  },
  modalAuthorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalDate: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  modalTitle: { 
    fontSize: 26, 
    fontWeight: '800', 
    marginBottom: 20,
    color: '#1E293B',
    lineHeight: 32,
  },
  modalAuthor: { 
    fontSize: 14, 
    color: '#64748B', 
    marginBottom: 20,
    fontWeight: '500',
  },
  modalContent: { 
    fontSize: 16, 
    lineHeight: 26,
    color: '#374151',
  },
});