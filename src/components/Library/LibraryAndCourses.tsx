import { useState, useEffect } from 'react';
import { Plus, BookOpen, Edit, Trash2, Play, Loader2, FileText, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CourseCard } from './CourseCard';
import { CreateCourseModal } from './CreateCourseModal';
import { CourseDetailModal } from './CourseDetailModal';

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
  created_by_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  parts_count?: number;
}

export function LibraryAndCourses() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'courses' | 'library'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [documents, setDocuments] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('library_courses')
        .select(`
          *,
          created_by_profile:profiles!library_courses_created_by_fkey (
            full_name,
            avatar_url
          )
        `)
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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
      fetchAll();
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Error al eliminar el curso');
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
  const itemType = activeTab === 'courses' ? 'curso' : 'documento';
  const itemTypePlural = activeTab === 'courses' ? 'cursos' : 'documentos';

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

      {currentItems.length === 0 ? (
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
              ? `Comienza agregando tu primer ${itemType}`
              : `Aún no se han agregado ${itemTypePlural} a la biblioteca`}
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
              Crear Primer {activeTab === 'courses' ? 'Curso' : 'Documento'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentItems.map((item) => (
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
          onClose={handleCloseModal}
          onSuccess={() => {
            handleCloseModal();
            fetchAll();
          }}
        />
      )}

      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => {
            setSelectedCourse(null);
            fetchCourses(); // Refrescar para actualizar conteo de partes
          }}
        />
      )}
    </div>
  );
}

