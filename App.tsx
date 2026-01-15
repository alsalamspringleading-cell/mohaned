
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  Package, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Search, 
  TrendingUp, 
  Sparkles,
  X,
  RefreshCcw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  ChevronDown,
  Download,
  LogOut,
  Mail,
  Chrome,
  CloudCheck,
  Loader2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where 
} from "firebase/firestore";
import { auth, db, googleProvider } from './services/firebase';
import { InventoryItem, Category } from './types';
import { getInventoryAdvice } from './services/geminiService';
import StatsCard from './components/StatsCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [updateAmounts, setUpdateAmounts] = useState<Record<string, string>>({});
  
  // Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    category: Category.Clothes,
    quantity: 1,
    size: ''
  });

  // 1. Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Sync
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    setIsSyncing(true);
    // Reference to user's specific inventory document
    const userDocRef = doc(db, "inventories", user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setItems(docSnap.data().items || []);
      }
      setIsSyncing(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Save to Cloud Helper
  const syncToCloud = async (newItems: InventoryItem[]) => {
    if (!user) return;
    try {
      setIsSyncing(true);
      await setDoc(doc(db, "inventories", user.uid), {
        items: newItems,
        lastUpdated: new Date().toISOString(),
        userEmail: user.email
      });
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Handlers ---
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      alert("خطأ في تسجيل الدخول عبر قوقل");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent, isRegister: boolean) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
      } else {
        await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      }
    } catch (error: any) {
      alert("حدث خطأ: " + error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    doc.setFont("helvetica", "bold");
    doc.text("Sports Stock Pro - Inventory Report", 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 105, 22, { align: "center" });
    doc.text(`User ID: ${user?.uid}`, 105, 27, { align: "center" });

    const tableData = items.map(item => [
      item.name,
      item.category,
      item.size,
      item.quantity,
      new Date(item.lastUpdated).toLocaleDateString()
    ]);

    (doc as any).autoTable({
      head: [['Product', 'Category', 'Size', 'Qty', 'Last Update']],
      body: tableData,
      startY: 35,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`inventory_${user?.uid.substring(0, 5)}_${new Date().getTime()}.pdf`);
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, { name: string, category: Category, sizes: InventoryItem[] }> = {};
    items.forEach(item => {
      const key = `${item.name}-${item.category}`;
      if (!groups[key]) groups[key] = { name: item.name, category: item.category, sizes: [] };
      groups[key].sizes.push(item);
    });
    return Object.values(groups).filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) || group.category.includes(searchTerm)
    );
  }, [items, searchTerm]);

  const existingProducts = useMemo(() => {
    const unique = new Map<string, Category>();
    items.forEach(item => unique.set(item.name, item.category));
    return Array.from(unique.entries()).map(([name, category]) => ({ name, category }));
  }, [items]);

  const filteredSuggestions = useMemo(() => {
    if (!newItem.name) return existingProducts;
    return existingProducts.filter(p => p.name.includes(newItem.name));
  }, [newItem.name, existingProducts]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    let updatedItems = [...items];
    const existingIndex = items.findIndex(i => i.name === newItem.name && i.size === newItem.size && i.category === newItem.category);
    
    if (existingIndex > -1) {
      updatedItems[existingIndex] = { 
        ...updatedItems[existingIndex], 
        quantity: updatedItems[existingIndex].quantity + newItem.quantity, 
        lastUpdated: new Date().toISOString() 
      };
    } else {
      updatedItems = [{ ...newItem, id: Math.random().toString(36).substr(2, 9), lastUpdated: new Date().toISOString() }, ...updatedItems];
    }
    
    await syncToCloud(updatedItems);
    setIsModalOpen(false);
    setNewItem({ name: '', category: Category.Clothes, quantity: 1, size: '' });
  };

  const applyUpdate = async (itemId: string, isAddition: boolean) => {
    const amount = parseInt(updateAmounts[itemId] || '0');
    if (isNaN(amount) || amount <= 0) return;
    
    const updatedItems = items.map(item => item.id === itemId 
      ? { ...item, quantity: Math.max(0, isAddition ? item.quantity + amount : item.quantity - amount), lastUpdated: new Date().toISOString() } 
      : item
    );
    
    await syncToCloud(updatedItems);
    setUpdateAmounts(prev => ({ ...prev, [itemId]: '' }));
  };

  const deleteItemSize = async (id: string) => {
    const updatedItems = items.filter(i => i.id !== id);
    await syncToCloud(updatedItems);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="text-blue-500 animate-spin w-12 h-12" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-6 mb-6">
              <Package className="text-white w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">مخزن السحاب الرياضي</h2>
            <p className="text-slate-400 font-medium">بياناتك محفوظة دائماً عبر Firebase</p>
          </div>

          <form onSubmit={(e) => handleEmailAuth(e, false)} className="space-y-4">
            <input 
              required type="email" placeholder="البريد الإلكتروني"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-400 font-bold"
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
            />
            <input 
              required type="password" placeholder="كلمة المرور"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-400 font-bold"
              value={loginPass} onChange={e => setLoginPass(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all">دخول</button>
              <button type="button" onClick={(e) => handleEmailAuth(e, true)} className="flex-1 border-2 border-slate-100 text-slate-700 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all">تسجيل جديد</button>
            </div>
          </form>

          <div className="relative my-8 text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <span className="relative bg-white px-4 text-xs font-black text-slate-300 uppercase">أو المزامنة المباشرة</span>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Chrome size={20} className="text-red-500" />
            <span>المتابعة باستخدام قوقل</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 pb-12">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Package className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-none">سبورت لوجستيك</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">متصل: {user.email}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={exportToPDF} className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-bold text-xs">
              <Download size={18} /><span className="hidden sm:inline">تصدير PDF</span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-all font-bold shadow-lg shadow-slate-200 text-sm">
              <Plus size={20} /><span>إضافة منتج</span>
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StatsCard title="أصناف سحابية" value={groupedItems.length} icon={<Layers />} color="bg-blue-600" />
          <StatsCard title="تنبيهات النقص" value={items.filter(i => i.quantity < 3).length} icon={<AlertTriangle />} color="bg-rose-500" />
          <StatsCard title="إجمالي الوحدات" value={items.reduce((a, b) => a + b.quantity, 0)} icon={<TrendingUp />} color="bg-emerald-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800">جرد المخزون المركزي</h2>
                {isSyncing && <div className="flex items-center gap-2 text-blue-500 text-[10px] font-bold animate-pulse"><RefreshCcw size={12} className="animate-spin" /> جاري المزامنة...</div>}
              </div>

              <div className="divide-y divide-slate-50">
                {groupedItems.map((group, idx) => (
                  <div key={idx} className="p-8 hover:bg-slate-50/30 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-start gap-8">
                      <div className="md:w-1/4">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{group.category}</span>
                        <h3 className="text-xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">{group.name}</h3>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.sizes.map(sizeItem => (
                          <div key={sizeItem.id} className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-1 h-full ${sizeItem.quantity < 3 ? 'bg-rose-500' : 'bg-slate-100'}`}></div>
                            <div className="flex items-center justify-between mb-4">
                              <div><p className="text-[10px] font-bold text-slate-400">المقاس</p><p className="text-lg font-black">{sizeItem.size}</p></div>
                              <div className="text-left"><p className="text-[10px] font-bold text-slate-400">الكمية</p><p className={`text-2xl font-black ${sizeItem.quantity < 3 ? 'text-rose-600' : 'text-slate-800'}`}>{sizeItem.quantity}</p></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" className="w-full bg-slate-50 border-none rounded-xl p-2 text-center font-bold text-sm shadow-inner"
                                placeholder="0" value={updateAmounts[sizeItem.id] || ''}
                                onChange={e => setUpdateAmounts({...updateAmounts, [sizeItem.id]: e.target.value})}
                              />
                              <div className="flex gap-1">
                                <button onClick={() => applyUpdate(sizeItem.id, false)} disabled={sizeItem.quantity === 0 || isSyncing} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all disabled:opacity-30"><ArrowDownToLine size={16} /></button>
                                <button onClick={() => applyUpdate(sizeItem.id, true)} disabled={isSyncing} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><ArrowUpFromLine size={16} /></button>
                                <button onClick={() => deleteItemSize(sizeItem.id)} disabled={isSyncing} className="p-2 text-slate-300 hover:text-rose-500 rounded-xl"><Trash2 size={16} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {groupedItems.length === 0 && (
                  <div className="p-24 text-center text-slate-300">
                    <CloudCheck size={64} className="mx-auto mb-4 opacity-10" />
                    <p className="text-xl font-bold">ابدأ بإضافة أول منتج لتخزينه سحابياً</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md"><Sparkles className="text-amber-300 w-5 h-5" /></div><h3 className="font-black text-xl">تحليل Gemini</h3></div>
                {aiAdvice ? <div className="bg-white/5 rounded-3xl p-5 text-[12px] leading-relaxed mb-8 border border-white/10 max-h-[400px] overflow-y-auto custom-scrollbar">{aiAdvice}</div> : <p className="text-slate-400 text-sm mb-8">سيقوم الذكي بتحليل مخزونك السحابي فور طلبك.</p>}
                <button 
                  onClick={async () => { setIsAiLoading(true); setAiAdvice(await getInventoryAdvice(items)); setIsAiLoading(false); }}
                  disabled={isAiLoading || items.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {isAiLoading ? <RefreshCcw className="animate-spin" /> : <RefreshCcw />} تحديث التقرير الذكي
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-3xl font-black text-slate-800">إضافة للسحاب</h3>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-50 p-3 rounded-full text-slate-400 hover:text-rose-500 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={addItem} className="p-10 space-y-8">
              <div className="relative" ref={suggestionRef}>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pr-2">اسم الصنف</label>
                <div className="relative">
                  <input required autoFocus type="text" className="w-full p-5 bg-slate-50 border-none rounded-[2rem] focus:ring-4 focus:ring-blue-100 font-bold" placeholder="نايكي، أديداس، إلخ..." value={newItem.name} onChange={e => { setNewItem({...newItem, name: e.target.value}); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} />
                  <ChevronDown className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                </div>
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                    <div className="p-2">
                      {filteredSuggestions.map((p, i) => (
                        <button key={i} type="button" className="w-full text-right p-4 hover:bg-blue-50 transition-colors rounded-2xl flex items-center justify-between group" onClick={() => { setNewItem(prev => ({ ...prev, name: p.name, category: p.category })); setShowSuggestions(false); }}>
                          <span className="font-bold text-slate-700 group-hover:text-blue-700">{p.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{p.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pr-2">الفئة</label><select className="w-full p-5 bg-slate-50 border-none rounded-[2rem] focus:ring-4 focus:ring-blue-100 font-bold appearance-none cursor-pointer" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value as Category})}>{Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div><label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pr-2">المقاس</label><input required type="text" className="w-full p-5 bg-slate-50 border-none rounded-[2rem] focus:ring-4 focus:ring-blue-100 font-bold" placeholder="XL, 42, إلخ" value={newItem.size} onChange={e => setNewItem({...newItem, size: e.target.value})} /></div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pr-2">الكمية</label>
                <div className="flex items-center gap-6 bg-slate-50 p-3 rounded-[2.5rem]">
                  <button type="button" onClick={() => setNewItem({...newItem, quantity: Math.max(1, newItem.quantity - 1)})} className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center font-black text-2xl hover:bg-slate-100">-</button>
                  <input type="number" className="flex-1 bg-transparent border-none text-center font-black text-3xl focus:outline-none" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})} />
                  <button type="button" onClick={() => setNewItem({...newItem, quantity: newItem.quantity + 1})} className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center font-black text-2xl hover:bg-blue-700">+</button>
                </div>
              </div>
              <button type="submit" disabled={isSyncing} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-blue-600 transition-all shadow-2xl disabled:opacity-50">تأكيد ومزامنة</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
