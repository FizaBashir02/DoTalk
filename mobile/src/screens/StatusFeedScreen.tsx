import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TextInput, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

// Stub Data for representation - disabled for production mode
const MOCK_CHATS: any[] = [];

export default function StatusFeedScreen({ navigation, route }: any) {
  const { user, logout, updateProfile } = useAuth();
  const tabName = route?.name || 'Chats'; // Chats, Groups, Profile
  const [search, setSearch] = useState('');
  
  // Profile settings states
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');

  const [chats, setChats] = useState([...MOCK_CHATS]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
    }
  }, [user]);

  useEffect(() => {
    // Attempt to gather chats from the active API
    async function fetchServerRooms() {
      try {
        const resp = await api.get('/api/chats');
        if (resp.data && Array.isArray(resp.data)) {
          // Normalize server models to client keys
          const loaded = resp.data.map((c: any) => ({
            id: c._id,
            title: c.isGroup ? c.groupName : (c.participantsInfo?.find((p: any) => p._id !== user?._id)?.fullName || 'Direct Chat'),
            image: c.isGroup ? c.groupImage : (c.participantsInfo?.find((p: any) => p._id !== user?._id)?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'),
            text: c.lastMessageText || 'No messages yet',
            time: c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
            unread: 0,
            isGroup: c.isGroup,
            online: c.isGroup ? false : c.participantsInfo?.find((p: any) => p._id !== user?._id)?.onlineStatus === 'online'
          }));
          setChats(loaded);
        }
      } catch (err) {
        console.log('Using local beautiful simulated contacts fallback.');
        setChats(MOCK_CHATS);
      }
    }
    fetchServerRooms();
  }, [tabName]);

  const renderChatItem = ({ item }: { item: any }) => {
    if (tabName === 'Chats' && item.isGroup) return null;
    if (tabName === 'Groups' && !item.isGroup) return null;

    return (
      <TouchableOpacity 
        style={styles.chatRow} 
        onPress={() => navigation.navigate('ChatWindow', { chat: item })}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }} style={styles.avatar} />
          {item.online && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>{item.title}</Text>
            <Text style={styles.chatTime}>{item.time}</Text>
          </View>
          <View style={styles.chatFooter}>
            <Text style={styles.chatLastText} numberOfLines={1}>
              {item.text}
            </Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FEEBC5" barStyle="dark-content" />
      
      {/* Dynamic Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLogo}>DoTalk</Text>
          <Text style={styles.headerSub}>{tabName} Channel Hub</Text>
        </View>
        
        {/* Quick action profile icon */}
        <TouchableOpacity style={styles.headerIconContainer}>
          <Text style={{ fontSize: 20 }}>💬</Text>
        </TouchableOpacity>
      </View>

      {/* Render based on Active Tab Route */}
      {tabName === 'Profile' ? (
        <ScrollView contentContainerStyle={styles.profileContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.profileAvatarCard}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }} 
              style={styles.bigAvatar} 
            />
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileUsername}>@{username}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.blockLabel}>Display Name</Text>
            <TextInput 
              style={styles.profileInput} 
              value={fullName} 
              onChangeText={setFullName} 
            />
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.blockLabel}>Username</Text>
            <TextInput 
              style={styles.profileInput} 
              value={username} 
              autoCapitalize="none"
              onChangeText={setUsername} 
            />
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.blockLabel}>Bio / About</Text>
            <TextInput 
              style={styles.profileInput} 
              value={bio} 
              multiline
              onChangeText={setBio} 
            />
          </View>

          <TouchableOpacity 
            style={styles.saveBtn} 
            onPress={async () => {
              const success = await updateProfile(fullName, username, bio);
              if (success) {
                Alert.alert('Success', 'Profile updated successfully!');
              }
            }}
          >
            <Text style={styles.saveText}>Save Details</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: '#F44336', marginTop: 12 }]} 
            onPress={logout}
          >
            <Text style={styles.saveText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Search Box */}
          <View style={styles.searchBox}>
            <TextInput 
              style={styles.searchInput}
              placeholder={`Search ${tabName.toLowerCase()}...`}
              placeholderTextColor="#8C6A4D"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* List views */}
          <FlatList
            data={chats.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))}
            renderItem={renderChatItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No Active Conversations found.</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAECE1',
  },
  header: {
    height: 70,
    backgroundColor: '#FEEBC5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#8C6A4D22',
  },
  headerLogo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3B2E2B',
  },
  headerSub: {
    fontSize: 10,
    color: '#8C6A4D',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B2E2B22',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    top: 15,
  },
  searchBox: {
    padding: 16,
    backgroundColor: '#FEEBC566',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#8C6A4D22',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#3B2E2B',
  },
  listContent: {
    padding: 16,
  },
  chatRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#3B2E2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#FAECE1',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3B2E2B',
  },
  chatTime: {
    fontSize: 10,
    color: '#8C6A4D',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatLastText: {
    fontSize: 12,
    color: '#8C6A4D',
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: '#3B2E2B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FEEBC5',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#8C6A4D',
    fontWeight: 'bold',
  },
  profileContainer: {
    padding: 24,
    alignItems: 'center',
  },
  profileAvatarCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  bigAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#3B2E2B',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3B2E2B',
  },
  profileUsername: {
    fontSize: 12,
    color: '#8C6A4D',
    fontWeight: 'bold',
  },
  infoBlock: {
    width: '100%',
    marginBottom: 16,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3B2E2B',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  profileInput: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#8C6A4D22',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#3B2E2B',
  },
  saveBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#3B2E2B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveText: {
    fontSize: 13,
    color: '#FEEBC5',
    fontWeight: 'bold',
  },
});
