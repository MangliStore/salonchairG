/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import React from 'react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Layout, 
  Plus, 
  LogOut, 
  Folder, 
  CheckSquare, 
  Users, 
  Settings, 
  ChevronRight,
  Search,
  Bell,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: 'admin' | 'member';
  createdAt: any;
}

interface Studio {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: any;
}

interface Project {
  id: string;
  studioId: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: any;
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-black text-white shadow-lg' 
        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${className}`}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudio, setActiveStudio] = useState<Studio | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Ensure user profile exists
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            role: 'member',
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(userSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
        setStudios([]);
        setActiveStudio(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Studios Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'studios'), 
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studioList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Studio));
      setStudios(studioList);
      if (studioList.length > 0 && !activeStudio) {
        setActiveStudio(studioList[0]);
      }
    }, (error) => {
      console.error("Firestore Error (Studios):", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Projects Listener
  useEffect(() => {
    if (!activeStudio) {
      setProjects([]);
      return;
    }

    const q = query(collection(db, `studios/${activeStudio.id}/projects`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      console.error("Firestore Error (Projects):", error);
    });

    return () => unsubscribe();
  }, [activeStudio]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const createStudio = async () => {
    if (!user) return;
    const name = prompt("Enter Studio Name:");
    if (!name) return;

    try {
      await addDoc(collection(db, 'studios'), {
        name,
        ownerId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to create studio:", error);
    }
  };

  const createProject = async () => {
    if (!activeStudio) return;
    const name = prompt("Enter Project Name:");
    if (!name) return;

    try {
      await addDoc(collection(db, `studios/${activeStudio.id}/projects`), {
        name,
        studioId: activeStudio.id,
        description: "A new project in " + activeStudio.name,
        status: 'active',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-black border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight text-zinc-900">Studio</h1>
            <p className="text-zinc-500 text-lg">Collaborative workspace for creative teams.</p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg hover:bg-zinc-800 transition-all duration-300 shadow-xl shadow-black/10 flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebase/hero/google-logo.svg" className="w-6 h-6 bg-white p-1 rounded-full" alt="Google" />
            Continue with Google
          </button>
          
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
            Securely powered by Firebase
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-50 flex overflow-hidden font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-72 bg-white border-r border-zinc-100 flex flex-col z-20"
          >
            <div className="p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Studio</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-400">
                <X size={20} />
              </button>
            </div>

            <div className="px-4 space-y-1 flex-1">
              <SidebarItem icon={Layout} label="Dashboard" active />
              <SidebarItem icon={Folder} label="Projects" />
              <SidebarItem icon={CheckSquare} label="Tasks" />
              <SidebarItem icon={Users} label="Team" />
              <SidebarItem icon={Settings} label="Settings" />
            </div>

            <div className="p-4 border-t border-zinc-100">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-50">
                <img src={profile?.photoURL} className="w-10 h-10 rounded-full border border-white shadow-sm" alt="Profile" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile?.displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{profile?.email}</p>
                </div>
                <button onClick={handleLogout} className="text-zinc-400 hover:text-red-500 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white border-bottom border-zinc-100 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-400 hover:text-zinc-900">
                <Menu size={24} />
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black/5 w-64 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-400 hover:text-zinc-900 relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button 
              onClick={createStudio}
              className="bg-black text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all"
            >
              <Plus size={18} />
              New Studio
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Studio Selector */}
          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {studios.map(studio => (
              <button
                key={studio.id}
                onClick={() => setActiveStudio(studio)}
                className={`px-6 py-3 rounded-2xl whitespace-nowrap transition-all duration-300 ${
                  activeStudio?.id === studio.id
                    ? 'bg-white shadow-md border-zinc-200 text-zinc-900 font-bold scale-105'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {studio.name}
              </button>
            ))}
          </div>

          {activeStudio ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-zinc-900">{activeStudio.name}</h1>
                  <p className="text-zinc-500">Manage your projects and team collaboration.</p>
                </div>
                <button 
                  onClick={createProject}
                  className="bg-white border border-zinc-200 text-zinc-900 px-6 py-3 rounded-2xl font-semibold hover:bg-zinc-50 transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add Project
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Total Projects</p>
                  <p className="text-4xl font-bold mt-2">{projects.length}</p>
                </Card>
                <Card>
                  <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Active Tasks</p>
                  <p className="text-4xl font-bold mt-2">12</p>
                </Card>
                <Card>
                  <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Team Members</p>
                  <p className="text-4xl font-bold mt-2">{activeStudio.members.length}</p>
                </Card>
              </div>

              {/* Projects List */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  Recent Projects
                  <ChevronRight size={20} className="text-zinc-300" />
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {projects.map(project => (
                    <motion.div
                      key={project.id}
                      layoutId={project.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Card className="group cursor-pointer">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-zinc-50 rounded-xl group-hover:bg-black group-hover:text-white transition-colors">
                            <Folder size={24} />
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            project.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold mb-1">{project.name}</h4>
                        <p className="text-zinc-500 text-sm mb-6 line-clamp-2">{project.description}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-zinc-200" />
                            ))}
                          </div>
                          <p className="text-xs text-zinc-400 font-medium">Updated 2h ago</p>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                  {projects.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-zinc-100/50 rounded-3xl border-2 border-dashed border-zinc-200">
                      <p className="text-zinc-400 font-medium">No projects yet. Create your first one!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-300">
                <Layout size={48} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Welcome to Studio</h2>
                <p className="text-zinc-500 max-w-sm mx-auto mt-2">
                  Create a studio to start collaborating on projects and managing your creative workflow.
                </p>
              </div>
              <button 
                onClick={createStudio}
                className="bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-black/10"
              >
                Create Your First Studio
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
