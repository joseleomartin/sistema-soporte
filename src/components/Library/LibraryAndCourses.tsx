import { useState, useEffect } from 'react';
import { Plus, BookOpen, Edit, Trash2, Play, Loader2, FileText, GraduationCap, Folder, FolderOpen, ArrowLeft, FolderPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CourseCard } from './CourseCard';
import { CreateCourseModal } from './CreateCourseModal';
import { CourseDetailModal } from './CourseDetailModal';
import { CreateFolderModal } from './CreateFolderModal';

interface Course {
  id: string;
  title: string;
  description: string;
  youtube_url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  type?: 'course' | 'document';
  folder_id?: string | null;
  created_by_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  parts_count?: number;
}

interface Folder {
  id: string;
  name: string;
  description: string | null;
  type: 'course' | 'document';
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  items_count?: number;
}

export function LibraryAndCourses() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'courses' | 'library'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [documents, setDocuments] = useState<Course[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [folderItems, setFolderItems] = useState<Course[]>([]);

  useEffect(() => {
    fetchAll();
  }, [activeTab]);

  useEffect(() => {
    if (selectedFolder) {
      fetchFolderItems();
    }
  }, [selectedFolder]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      
      // Cargar carpetas
      const { data: foldersData, error: foldersError } = await supabase
        .from('library_folders')
        .select(`
          *,
          created_by_profile:profiles!library_folders_created_by_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('type', activeTab === 'courses' ? 'course' : 'document')
        .order('created_at', { ascending: false });

      if (foldersError) throw foldersError;

      // Cargar cursos/documentos
      const { data, error } = await supabase
        .from('library_courses')
        .select(`
          *,
          created_by_profile:profiles!library_courses_created_by_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('type', activeTab === 'courses' ? 'course' : 'document')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Separar cursos y documentos
      const coursesData = (data || []).filter(item => (item.type || 'course') === 'course');
      const documentsData = (data || []).filter(item => item.type === 'document');

      // Obtener el conteo de partes solo para cursos
      if (coursesData.length > 0) {
        const courseIds = coursesData.map(course => course.id);
        const { data: partsData, error: partsError } = await supabase
          .from('course_parts')
          .select('course_id')
          .in('course_id', courseIds);

        if (partsError) throw partsError;

        // Contar partes por curso
        const partsCountMap: { [key: string]: number } = {};
        if (partsData) {
          partsData.forEach(part => {
            partsCountMap[part.course_id] = (partsCountMap[part.course_id] || 0) + 1;
          });
        }

        // Agregar el conteo a cada curso
        const coursesWithParts = coursesData.map(course => ({
          ...course,
          parts_count: partsCountMap[course.id] || 0,
        }));

        setCourses(coursesWithParts);
      } else {
        setCourses([]);
      }

      setDocuments(documentsData);

      // Contar items por carpeta y agregar a carpetas
      if (foldersData) {
        const foldersWithCounts = await Promise.all(
          foldersData.map(async (folder) => {
            const { count } = await supabase
              .from('library_courses')
              .select('*', { count: 'exact', head: true })
              .eq('folder_id', folder.id);
            
            return {
              ...folder,
              items_count: count || 0,
            };
          })
        );
        setFolders(foldersWithCounts);
      } else {
        setFolders([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderItems = async () => {
    if (!selectedFolder) return;

    try {
      const { data, error } = await supabase
        .from('library_courses')
        .select(`
          *,
          created_by_profile:profiles!library_courses_created_by_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('folder_id', selectedFolder.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Obtener conteo de partes para cursos
      if (data && data.length > 0 && selectedFolder.type === 'course') {
        const courseIds = data.map(course => course.id);
        const { data: partsData } = await supabase
          .from('course_parts')
          .select('course_id')
          .in('course_id', courseIds);

        const partsCountMap: { [key: string]: number } = {};
        if (partsData) {
          partsData.forEach(part => {
            partsCountMap[part.course_id] = (partsCountMap[part.course_id] || 0) + 1;
          });
        }

        const itemsWithParts = data.map(course => ({
          ...course,
          parts_count: partsCountMap[course.id] || 0,
        }));

        setFolderItems(itemsWithParts);
      } else {
        setFolderItems(data || []);
      }
    } catch (error) {
      console.error('Error fetching folder items:', error);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este curso?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('library_courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      if (selectedFolder) {
        fetchFolderItems();
      } else {
        fetchAll();
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Error al eliminar el curso');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta carpeta? Los cursos/documentos dentro de ella no se eliminarán, solo se quitarán de la carpeta.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('library_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
      fetchAll();
      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Error al eliminar la carpeta');
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingCourse(null);
  };

  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentItems = activeTab === 'courses' ? courses : documents;
  const currentFolders = folders.filter(f => f.type === (activeTab === 'courses' ? 'course' : 'document'));
  const itemsWithoutFolder = currentItems.filter(item => !item.folder_id);
  const itemType = activeTab === 'courses' ? 'curso' : 'documento';
  const itemTypePlural = activeTab === 'courses' ? 'cursos' : 'documentos';

  // Si hay una carpeta seleccionada, mostrar su contenido
  if (selectedFolder) {
    return (
      <div className="h-full overflow-auto">
        {/* Header mejorado */}
        <div className="mb-8">
          {/* Botón volver */}
          <div className="mb-4">
            <button
              onClick={() => setSelectedFolder(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
          
          {/* Título y acciones */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">
                    {selectedFolder.name}
                  </h1>
                </div>
              </div>
              {selectedFolder.description && (
                <p className="text-gray-600 text-sm ml-14">{selectedFolder.description}</p>
              )}
            </div>
            
            {isAdmin && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingCourse(null);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  {activeTab === 'courses' ? 'Nuevo Curso' : 'Nuevo Documento'}
                </button>
                <button
                  onClick={() => handleDeleteFolder(selectedFolder.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  <Trash2 className="w-5 h-5" />
                  Eliminar Carpeta
                </button>
              </div>
            )}
          </div>
        </div>

        {folderItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Esta carpeta está vacía
            </h3>
            <p className="text-gray-600 mb-4">
              {isAdmin
                ? `Agrega tu primer ${itemType} a esta carpeta`
                : `Aún no hay ${itemTypePlural} en esta carpeta`}
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingCourse(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Agregar {activeTab === 'courses' ? 'Curso' : 'Documento'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folderItems.map((item) => (
              <CourseCard
                key={item.id}
                course={item}
                onEdit={isAdmin ? () => handleEdit(item) : undefined}
                onDelete={isAdmin ? () => handleDelete(item.id) : undefined}
                onClick={() => setSelectedCourse(item)}
              />
            ))}
          </div>
        )}

        {showCreateModal && (
          <CreateCourseModal
            course={editingCourse}
            type={activeTab === 'courses' ? 'course' : 'document'}
            folderId={selectedFolder.id}
            onClose={handleCloseModal}
            onSuccess={() => {
              handleCloseModal();
              fetchFolderItems();
            }}
          />
        )}

        {selectedCourse && (
          <CourseDetailModal
            course={selectedCourse}
            onClose={() => {
              setSelectedCourse(null);
              fetchFolderItems();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Biblioteca y Cursos</h1>
          <p className="text-gray-600">
            Accede a recursos educativos, cursos y documentación
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateFolderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <FolderPlus className="w-5 h-5" />
              Nueva Carpeta
            </button>
            <button
              onClick={() => {
                setEditingCourse(null);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'courses' ? 'Nuevo Curso' : 'Nuevo Documento'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'courses'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            Cursos
            {courses.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {courses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'library'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            Biblioteca
            {documents.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {documents.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Carpetas */}
      {currentFolders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Carpetas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Folder className="w-8 h-8 text-blue-600" />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{folder.name}</h3>
                {folder.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{folder.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{folder.items_count || 0} {folder.items_count === 1 ? itemType : itemTypePlural}</span>
                  <span className="text-xs">
                    {folder.created_by_profile?.full_name || 'Usuario'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items sin carpeta */}
      {itemsWithoutFolder.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {currentFolders.length > 0 ? `${itemTypePlural.charAt(0).toUpperCase() + itemTypePlural.slice(1)} sin carpeta` : itemTypePlural.charAt(0).toUpperCase() + itemTypePlural.slice(1)}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {itemsWithoutFolder.map((item) => (
              <CourseCard
                key={item.id}
                course={item}
                onEdit={isAdmin ? () => handleEdit(item) : undefined}
                onDelete={isAdmin ? () => handleDelete(item.id) : undefined}
                onClick={() => setSelectedCourse(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {currentFolders.length === 0 && itemsWithoutFolder.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          {activeTab === 'courses' ? (
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          ) : (
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          )}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay {itemTypePlural} disponibles
          </h3>
          <p className="text-gray-600 mb-4">
            {isAdmin
              ? `Comienza creando una carpeta o agregando tu primer ${itemType}`
              : `Aún no se han agregado ${itemTypePlural} a la biblioteca`}
          </p>
          {isAdmin && (
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCreateFolderModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FolderPlus className="w-5 h-5" />
                Crear Carpeta
              </button>
              <button
                onClick={() => {
                  setEditingCourse(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Crear Primer {activeTab === 'courses' ? 'Curso' : 'Documento'}
              </button>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateCourseModal
          course={editingCourse}
          type={activeTab === 'courses' ? 'course' : 'document'}
          onClose={handleCloseModal}
          onSuccess={() => {
            handleCloseModal();
            fetchAll();
          }}
        />
      )}

      {showCreateFolderModal && (
        <CreateFolderModal
          type={activeTab === 'courses' ? 'course' : 'document'}
          onClose={() => setShowCreateFolderModal(false)}
          onSuccess={() => {
            setShowCreateFolderModal(false);
            fetchAll();
          }}
        />
      )}

      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => {
            setSelectedCourse(null);
            if (selectedFolder) {
              fetchFolderItems();
            } else {
              fetchAll();
            }
          }}
        />
      )}
    </div>
  );
}

