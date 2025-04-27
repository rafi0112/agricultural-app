// BlogsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from 'react-native';
import { blogsCol, auth } from './firebaseConfig';
import { addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function BlogsScreen() {
  const [blogs, setBlogs] = useState<{ id: string; title: string; content: string; authorId: string; authorName: string; createdAt: Date }[]>([]);
  const [newBlog, setNewBlog] = useState({
    title: '',
    content: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(blogsCol, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setBlogs(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as { title: string; content: string; authorId: string; authorName: string; createdAt: Date }) })));      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
    } catch (error) {
      Alert.alert('Error', 'Failed to post blog');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading blogs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Farmer Blogs</Text>
      
      <View style={styles.blogForm}>
        <TextInput
          placeholder="Blog Title"
          value={newBlog.title}
          onChangeText={text => setNewBlog({...newBlog, title: text})}
          style={styles.input}
        />
        <TextInput
          placeholder="Write your blog post..."
          value={newBlog.content}
          onChangeText={text => setNewBlog({...newBlog, content: text})}
          style={[styles.input, styles.contentInput]}
          multiline
        />
        <Button 
          title="Post Blog" 
          onPress={postBlog} 
        />
      </View>

      <FlatList
        data={blogs}
        renderItem={({ item }) => (
          <View style={styles.blogCard}>
            <Text style={styles.blogTitle}>{item.title}</Text>
            <Text style={styles.blogAuthor}>By: {item.authorName}</Text>
            <Text style={styles.blogContent}>{item.content}</Text>
          </View>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 40
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    textAlign: 'center',
    backgroundColor: '#fff',
    marginBottom: 10
  },
  blogForm: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5
  },
  contentInput: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  listContainer: {
    padding: 10
  },
  blogCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  blogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5
  },
  blogAuthor: {
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic'
  },
  blogContent: {
    lineHeight: 20
  }
});