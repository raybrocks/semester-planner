import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import { Download, Upload, Trash2, Edit2, Trash } from 'lucide-react';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import './App.css';

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag'];
const TIMES = ['17:00', '18:00', '19:00', '20:00'];
const ROOMS = ['Sal 1', 'Sal 2'];

function DroppableSlot({ id, children, onClick }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`matrix-slot ${isOver ? 'drag-over' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}

function DraggableCard({ item, onEdit, onDelete, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({ id: item.id, data: item, disabled });

  const durationStr = item.duration ? String(item.duration) : "60";
  const durationNum = parseInt(durationStr, 10);
  
  const timeStr = item.time || "17:00";
  const [hour, minute] = timeStr.split(':');
  const offsetMinutes = parseInt(minute || "0", 10);

  const HOUR_HEIGHT = 120; // Must match the CSS height of .cell-container / .matrix-time-cell
  const heightPixels = (durationNum / 60) * HOUR_HEIGHT;
  const topPixels = (offsetMinutes / 60) * HOUR_HEIGHT;

  const style = {
    transform: CSS.Translate.toString(transform),
    height: `${heightPixels - 4}px`,
    top: `${topPixels + 2}px`,
    zIndex: isDragging ? 100 : 10
  };

  const categoryClass = (item.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const isShort = durationNum <= 30;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`class-card ${categoryClass} ${isDragging ? 'is-dragging' : ''} ${isShort ? 'short-class' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="card-header">
        <span className="class-name">{item.className}</span>
        {item.level && <span className="level-tag">{item.level}</span>}
        {item.kompani && <span className="kompani-tag">KREVER AUDITION</span>}
        {!disabled && (
          <div className="card-actions">
            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
              <Edit2 size={14} />
            </button>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="teacher-name">{item.teacher}</div>
      <div className="category-tag">{item.category}</div>
    </div>
  );
}

function EditModal({ isOpen, onClose, onSave, initialData, slotId }) {
  const [formData, setFormData] = useState({
    className: '',
    level: '',
    kompani: false,
    teacher: '',
    category: 'Ungd/Voksen',
    room: 'Sal 1',
    duration: '60',
    time: '17:00'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData, duration: initialData.duration || '60', level: initialData.level || '', kompani: initialData.kompani || false });
    } else {
      const defaultRoom = slotId ? slotId.split('-')[2] : 'Sal 1';
      const defaultTime = slotId ? slotId.split('-')[1] : '17:00';
      setFormData({ className: '', level: '', kompani: false, teacher: '', category: 'Ungd/Voksen', room: defaultRoom, duration: '60', time: defaultTime });
    }
  }, [initialData, isOpen, slotId]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: initialData?.id || uuidv4(),
      day: initialData?.day || (slotId ? slotId.split('-')[0] : 'Mandag'),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{initialData ? 'Rediger Klasse' : 'Ny Klasse'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Starttid</label>
            <input 
              type="time" 
              className="form-input" 
              value={formData.time || '17:00'} 
              onChange={e => setFormData({...formData, time: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Danseklasse</label>
            <input 
              autoFocus
              className="form-input" 
              value={formData.className} 
              onChange={e => setFormData({...formData, className: e.target.value.toUpperCase()})}
              placeholder="F.EKS. HIP HOP"
              required
            />
          </div>
          <div className="form-group">
            <label>Nivå (Valgfritt)</label>
            <input 
              className="form-input" 
              value={formData.level} 
              onChange={e => setFormData({...formData, level: e.target.value.toUpperCase()})}
              placeholder="F.EKS. NIVÅ 1"
            />
          </div>
          <div className="form-group checkbox-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, marginTop: '0.5rem' }}>
              <input 
                type="checkbox"
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                checked={formData.kompani} 
                onChange={e => setFormData({...formData, kompani: e.target.checked})}
              />
              Kompani (Krever audition)
            </label>
          </div>
          <div className="form-group">
            <label>Pedagog</label>
            <input 
              className="form-input" 
              value={formData.teacher} 
              onChange={e => setFormData({...formData, teacher: e.target.value.toUpperCase()})}
              placeholder="F.EKS. OLA NORDMANN"
              required
            />
          </div>
          <div className="form-group">
            <label>Kategori</label>
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="category" 
                  value="Ungdom" 
                  checked={formData.category === 'Ungdom'}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                /> Ungdom
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="category" 
                  value="Ungd/Voksen" 
                  checked={formData.category === 'Ungd/Voksen'}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                /> Ungd/Voksen
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="category" 
                  value="Voksen" 
                  checked={formData.category === 'Voksen'}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                /> Voksen
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="category" 
                  value="Kids" 
                  checked={formData.category === 'Kids'}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                /> Kids
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="category" 
                  value="Egentrening" 
                  checked={formData.category === 'Egentrening'}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                /> Egentrening
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Varighet</label>
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="duration" 
                  value="60" 
                  checked={formData.duration === '60'}
                  onChange={e => setFormData({...formData, duration: e.target.value})}
                /> 60 min
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="duration" 
                  value="45" 
                  checked={formData.duration === '45'}
                  onChange={e => setFormData({...formData, duration: e.target.value})}
                /> 45 min
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="duration" 
                  value="30" 
                  checked={formData.duration === '30'}
                  onChange={e => setFormData({...formData, duration: e.target.value})}
                /> 30 min
              </label>
            </div>
          </div>
          {!slotId && (
            <div className="form-group">
              <label>Sal</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="room" 
                    value="Sal 1" 
                    checked={formData.room === 'Sal 1'}
                    onChange={e => setFormData({...formData, room: e.target.value})}
                  /> Sal 1
                </label>
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="room" 
                    value="Sal 2" 
                    checked={formData.room === 'Sal 2'}
                    onChange={e => setFormData({...formData, room: e.target.value})}
                  /> Sal 2
                </label>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Avbryt</button>
            <button type="submit" className="btn-primary">Lagre</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const initialData = [
  { id: "1", day: "Mandag", time: "17:00", room: "Sal 1", className: "K-POP 4-7 TRINN", level: "", teacher: "", category: "Kids" },
  { id: "2", day: "Mandag", time: "18:00", room: "Sal 1", className: "HIP HOP 5-7 TRINN", level: "NIVÅ 1", teacher: "TBA", category: "Kids" },
  { id: "3", day: "Mandag", time: "19:00", room: "Sal 1", className: "HIP HOP ENERGY MIX", level: "NIVÅ 2", teacher: "MARIE", category: "Ungd/Voksen" },
  { id: "4", day: "Mandag", time: "20:00", room: "Sal 1", className: "FRITRENING OPEN SESSION", level: "", teacher: "", category: "Egentrening" },
  { id: "5", day: "Mandag", time: "20:00", room: "Sal 1", className: "HIP HOP UNGDOM/VOKSNE", level: "", teacher: "MARIE", category: "Egentrening" },
  { id: "6", day: "Mandag", time: "17:00", room: "Sal 2", className: "HIP HOP 1-2 TRINN", level: "", teacher: "MALIN DALE", category: "Kids" },
  { id: "7", day: "Mandag", time: "19:00", room: "Sal 2", className: "HIP HOP VOKSEN 30+", level: "NIVÅ 1", teacher: "KAJA", category: "Voksen" },
  { id: "8", day: "Tirsdag", time: "17:00", room: "Sal 1", className: "KIDS 3-5 ÅR KNØTTEDANS", level: "", teacher: "INGER MARIT", category: "Kids" },
  { id: "9", day: "Tirsdag", time: "18:00", room: "Sal 1", className: "COMMERCIAL GIRLY UNGDOM/VOKSNE", level: "NIVÅ 2", teacher: "LINN", category: "Ungd/Voksen" },
  { id: "10", day: "Tirsdag", time: "19:00", room: "Sal 1", className: "HEELS 16+", level: "NIVÅ 1", teacher: "LINN", category: "Voksen" },
  { id: "11", day: "Tirsdag", time: "17:00", room: "Sal 2", className: "KIDS AKROBATIKK", level: "NIVÅ 1", teacher: "HILDE MARIA", category: "Kids" },
  { id: "12", day: "Tirsdag", time: "18:00", room: "Sal 2", className: "KIDS AKROBATIKK", level: "NIVÅ 2", teacher: "HILDE MARIA", category: "Kids" },
  { id: "13", day: "Onsdag", time: "17:00", room: "Sal 1", className: "KIDS BREAK", level: "", teacher: "TONY", category: "Kids" },
  { id: "14", day: "Onsdag", time: "18:00", room: "Sal 1", className: "HIP HOP COMMERCIAL 13-18 ÅR", level: "NIVÅ 1", teacher: "TBA", category: "Ungdom" },
  { id: "15", day: "Onsdag", time: "19:00", room: "Sal 1", className: "MODERNE / CONTEMPORARY UNGDOM / VOKSEN", level: "", teacher: "TBA", category: "Ungd/Voksen" },
  { id: "16", day: "Onsdag", time: "20:00", room: "Sal 1", className: "FRITRENING OPEN SESSION MODERNE", level: "", teacher: "", category: "Egentrening" },
  { id: "17", day: "Onsdag", time: "17:00", room: "Sal 2", className: "K-POP UNGDOM/VOKSEN", level: "", teacher: "", category: "Ungd/Voksen" },
  { id: "18", day: "Onsdag", time: "18:00", room: "Sal 2", className: "JAZZ- OG MODERNE MIX 5-7 TRINN", level: "", teacher: "TBA", category: "Kids" },
  { id: "19", day: "Torsdag", time: "17:00", room: "Sal 1", className: "HIP HOP 5-7 TRINN", level: "NIVÅ 2", teacher: "SARA", category: "Kids" },
  { id: "20", day: "Torsdag", time: "18:00", room: "Sal 1", className: "LATIN CHOREO UNGDOM/VOKSEN", level: "", teacher: "LINN", category: "Ungd/Voksen" },
  { id: "21", day: "Torsdag", time: "19:00", room: "Sal 1", className: "HIP HOP DRILLS UNGDOM / VOKSEN", level: "", teacher: "MARIE", category: "Ungd/Voksen" },
  { id: "22", day: "Torsdag", time: "20:00", room: "Sal 1", className: "KONKURRANSETRENING (LUKKET)", level: "", teacher: "", category: "Ungd/Voksen" },
  { id: "23", day: "Torsdag", time: "18:00", room: "Sal 2", className: "KIDS 3-4 TRINN", level: "", teacher: "SARA", category: "Kids" }
];

export default function App() {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState(() => localStorage.getItem("planStatus") || "In progress");
  const [isAdmin, setIsAdmin] = useState(false);
  
  const handleAdminLogin = () => {
    const pin = window.prompt("Skriv inn PIN-kode for å endre status (admin):");
    if (pin === "6292") {
      setIsAdmin(true);
    } else if (pin !== null) {
      alert("Feil PIN-kode!");
    }
  };
  
  useEffect(() => {
    localStorage.setItem("planStatus", status);
  }, [status]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "general"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status) {
          setStatus(data.status);
          localStorage.setItem("planStatus", data.status);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setDoc(doc(db, "settings", "general"), { status: newStatus }, { merge: true })
      .catch(e => console.error("Could not save status to DB", e));
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [targetSlot, setTargetSlot] = useState(null);



  const forceMigrate = () => {
    const saved = localStorage.getItem('timeplanDataV3');
    if (saved) {
      const localItems = JSON.parse(saved);
      let count = 0;
      localItems.forEach(item => {
        if (item && item.id) {
          // Sikre at id er en string
          const stringId = String(item.id);
          const safeItem = { ...item, id: stringId };
          
          setDoc(doc(db, "classes", stringId), safeItem)
            .catch(e => console.error("Kunne ikke lagre klasse:", item, e));
          count++;
        }
      });
      alert(`Gjenopprettet ${count} klasser fra lokal lagring til databasen!`);
    } else {
      alert("Fant ingen lokal lagring.");
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "classes"), (snapshot) => {
      const loadedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (loadedItems.length === 0) {
        // Om databasen er tom, sjekk om vi har lokal data fra tidligere
        const saved = localStorage.getItem('timeplanDataV3');
        if (saved) {
          const localItems = JSON.parse(saved);
          localItems.forEach(item => {
            setDoc(doc(db, "classes", item.id), item);
          });
          setItems(localItems);
        } else {
          // Hvis ingen lokal data, bruk standardoppsettet
          initialData.forEach(item => {
            setDoc(doc(db, "classes", item.id), item);
          });
          setItems(initialData);
        }
      } else {
        setItems(loadedItems);
      }
    });
    return () => unsubscribe();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    if (status !== 'In progress') return;
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    if (status !== 'In progress') return;
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const overId = over.id;
    let targetSlotStr = overId;
    
    if (items.find(i => i.id === overId)) {
      const overItem = items.find(i => i.id === overId);
      targetSlotStr = `${overItem.day}-${overItem.time}-${overItem.room}`;
    }
    
    if (targetSlotStr && targetSlotStr.includes('-')) {
      const parts = targetSlotStr.split('-');
      if (parts.length >= 3) {
        const newDay = parts[0];
        const newTime = parts[1];
        const newRoom = parts.slice(2).join('-');
        
        if (DAYS.includes(newDay) && TIMES.includes(newTime) && ROOMS.includes(newRoom)) {
          const oldMinutes = (activeItem.time || '17:00').split(':')[1] || '00';
          const newHour = newTime.split(':')[0];
          const updatedTime = `${newHour}:${oldMinutes}`;

          const updatedItem = { 
            ...activeItem, 
            day: newDay, 
            time: updatedTime, 
            room: newRoom 
          };
          setDoc(doc(db, "classes", updatedItem.id), updatedItem);
          setItems((items) => 
            items.map(item => 
              item.id === active.id ? updatedItem : item
            )
          );
        }
      }
    }
  };

  const handleSlotClick = (slotId) => {
    if (!isAdmin || status !== 'In progress') return;
    setTargetSlot(slotId);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setTargetSlot(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Er du sikker på at du vil slette denne klassen?")) {
      deleteDoc(doc(db, "classes", id));
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleSave = (data) => {
    setDoc(doc(db, "classes", data.id), data);
    if (editingItem) {
      setItems(items.map(i => i.id === data.id ? data : i));
    } else {
      setItems([...items, data]);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(items, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'timeplan-h2026.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        setItems(parsed);
      } catch(err) {
        alert("Kunne ikke lese filen.");
      }
    };
  };

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-titles">
          <h1>Semesterplanlegger</h1>
          <h2>Høst 2026</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <button 
              onClick={isAdmin ? () => setIsAdmin(false) : handleAdminLogin}
              style={{ 
                background: isAdmin ? '#8b5cf6' : '#e2e8f0', 
                color: isAdmin ? '#fff' : '#475569', 
                border: 'none', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '0.5rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}
              title={isAdmin ? "Logg ut av admin" : "Logg inn som admin"}
            >
              {isAdmin ? '👑 Admin Modus' : '👤 Visningsmodus'}
            </button>

            {isAdmin ? (
              <select className="status-dropdown" value={status} onChange={(e) => handleStatusChange(e.target.value)} style={{ margin: 0 }}>
                <option value="In progress">In progress</option>
                <option value="Finished">Finished</option>
              </select>
            ) : (
              <span className={`status-badge ${status === 'Finished' ? 'finished' : ''}`} style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Status: {status}
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="actions">
            <button onClick={forceMigrate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eab308', color: '#000', border: 'none', fontWeight: 'bold' }}>
              <Upload size={16} /> Gjenopprett fra lokalt
            </button>

            <button onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={16} /> Eksporter
            </button>
          </div>
        )}
      </header>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="matrix-container">
          <div className="matrix">
            <div className="matrix-header-cell sticky-col" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Tid \ Dag</div>
            {DAYS.map(day => (
              <div key={day} className="matrix-header-cell day-col">
                <div className="day-name">{day}</div>
                <div className="room-headers">
                  {ROOMS.map(room => (
                    <div key={room} className="room-header-label">{room}</div>
                  ))}
                </div>
              </div>
            ))}

            {TIMES.map(time => (
              <React.Fragment key={time}>
                <div className="matrix-time-cell">
                  {time} - {parseInt(time) + 1}:00
                </div>
                {DAYS.map(day => {
                  return (
                    <div key={`${day}-${time}`} className="cell-container">
                      {ROOMS.map(room => {
                        const slotId = `${day}-${time}-${room}`;
                        const slotHour = time.split(':')[0];
                        const slotItems = items.filter(item => {
                          if (item.day !== day || item.room !== room) return false;
                          const itemHour = (item.time || '17:00').split(':')[0];
                          return itemHour === slotHour;
                        });
                        
                        return (
                          <div key={slotId} className="room-container">
                            <DroppableSlot id={slotId} onClick={() => handleSlotClick(slotId)}>
                              {slotItems.map(item => (
                                <DraggableCard 
                                  key={item.id} 
                                  item={item} 
                                  onEdit={handleEdit}
                                  onDelete={handleDelete}
                                  disabled={!isAdmin || status !== 'In progress'}
                                />
                              ))}
                            </DroppableSlot>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        <DragOverlay>
          {activeItem ? (
            <div className={`class-card ${activeItem.category.toLowerCase()} is-dragging`}>
              <div className="card-header">
                <span className="class-name">{activeItem.className}</span>
              </div>
              <div className="teacher-name">{activeItem.teacher}</div>
              <div className="category-tag">{activeItem.category}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <EditModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingItem}
        slotId={targetSlot}
      />
    </div>
  );
}
