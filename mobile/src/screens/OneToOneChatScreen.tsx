import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, SafeAreaView, StatusBar, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getSocket, api } from '../utils/api';

export default function OneToOneChatScreen({ navigation, route }: any) {
  const { user, token } = useAuth();
  const chatItem = route?.params?.chat || { id: 'chat_larry', title: 'Larry Machigo', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' };

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // 1. Fetch previous history of this chat room
    async function loadHistory() {
      setLoading(true);
      try {
        const resp = await api.get(`/api/messages/${chatItem.id}`);
        if (resp.data && Array.isArray(resp.data)) {
          const loaded = resp.data.map((m: any) => ({
            id: m._id,
            text: m.text,
            senderId: m.senderId === user?._id ? 'me' : 'them',
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(loaded);
        }
      } catch (err) {
        console.log('Using standard beautiful placeholder conversation rows.');
        setMessages([
          { id: '1', text: 'Hey there! How are you doing?', senderId: 'them', time: '10:35 AM' },
          { id: '2', text: 'Let’s check the specs for the Bezel overlay!', senderId: 'them', time: '10:36 AM' },
          { id: '3', text: 'Sure thing! Porting and compiling active views now.', senderId: 'me', time: '10:38 AM' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();

    // 2. Initialize Socket Connection & join room
    if (token) {
      const socket = getSocket(token);
      socketRef.current = socket;

      socket.emit('join_chat', { chatId: chatItem.id });

      socket.on('message_received', (incomingMsg: any) => {
        if (incomingMsg.chatId === chatItem.id) {
          setMessages((prev) => [
            ...prev,
            {
              id: incomingMsg._id,
              text: incomingMsg.text,
              senderId: incomingMsg.senderId === user?._id ? 'me' : 'them',
              time: new Date(incomingMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('message_received');
      }
    };
  }, [chatItem.id, token]);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    if (socketRef.current) {
      // Stream over real web-socket for production delivery
      socketRef.current.emit('send_message', {
        chatId: chatItem.id,
        text: inputText,
      });
    } else {
      // Fallback local representation
      const newMsg = {
        id: Math.random().toString(),
        text: inputText,
        senderId: 'me',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, newMsg]);
    }

    setInputText('');
  };

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 250);
  }, [messages]);

  const renderMessageRow = ({ item }: { item: any }) => {
    const isMe = item.senderId === 'me';
    return (
      <View style={[styles.msgRow, isMe ? styles.msgMeRow : styles.msgThemRow]}>
        {!isMe && <Image source={{ uri: chatItem.image || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' }} style={styles.msgAvatar} />}
        <View style={[styles.msgBubble, isMe ? styles.msgMeBubble : styles.msgThemBubble]}>
          <Text style={[styles.msgText, isMe ? styles.msgMeText : styles.msgThemText]}>{item.text}</Text>
          <Text style={[styles.msgTime, isMe ? styles.msgMeTime : styles.msgThemTime]}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3B2E2B" barStyle="light-content" />
      
      {/* Chat header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        
        <Image source={{ uri: chatItem.image }} style={styles.headerAvatar} />
        
        <View style={styles.titleArea}>
          <Text style={styles.headerTitle}>{chatItem.title}</Text>
          <Text style={styles.headerSub}>Online • Last seen recently</Text>
        </View>

        <TouchableOpacity style={styles.moreBtn}>
          <Text style={styles.moreBtnText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Keyboard Avoiding Container */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageRow}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#8C6A4D"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={sendMessage}>
            <Text style={styles.submitBtnIcon}>➔</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAECE1',
  },
  header: {
    height: 64,
    backgroundColor: '#3B2E2B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  backBtnText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FEEBC5',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#FEEBC5',
  },
  titleArea: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FEEBC5',
  },
  headerSub: {
    fontSize: 10,
    color: '#A67C52',
    fontWeight: '500',
  },
  moreBtn: {
    padding: 8,
  },
  moreBtnText: {
    fontSize: 20,
    color: '#FEEBC5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  msgMeRow: {
    alignSelf: 'flex-end',
  },
  msgThemRow: {
    alignSelf: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  msgBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  msgMeBubble: {
    backgroundColor: '#3B2E2B',
    borderBottomRightRadius: 2,
  },
  msgThemBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#8C6A4D22',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  msgMeText: {
    color: '#FFFFFF',
  },
  msgThemText: {
    color: '#3B2E2B',
  },
  msgTime: {
    fontSize: 8,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  msgMeTime: {
    color: '#FEEBC5aa',
  },
  msgThemTime: {
    color: '#8C6A4D',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#8C6A4D11',
  },
  actionBtn: {
    padding: 8,
  },
  actionBtnIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FAECE188',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    fontSize: 13,
    color: '#3B2E2B',
  },
  submitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B2E2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnIcon: {
    color: '#FEEBC5',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
