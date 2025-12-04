import { useState, useEffect } from 'react';
import { Plus, BookOpen, Edit, Trash2, Play, Loader2 } from 'lucide-react';
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
  created_by_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
}

export function LibraryAndCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
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
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
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
      fetchCourses();
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

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Biblioteca y Cursos</h1>
          <p className="text-gray-600">
            Accede a recursos educativos y cursos
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Curso
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay cursos disponibles
          </h3>
          <p className="text-gray-600 mb-4">
            {isAdmin
              ? 'Comienza agregando tu primer curso'
              : 'Aún no se han agregado cursos a la biblioteca'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Crear Primer Curso
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={isAdmin ? () => handleEdit(course) : undefined}
              onDelete={isAdmin ? () => handleDelete(course.id) : undefined}
              onClick={() => setSelectedCourse(course)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateCourseModal
          course={editingCourse}
          onClose={handleCloseModal}
          onSuccess={() => {
            handleCloseModal();
            fetchCourses();
          }}
        />
      )}

      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
        />
      )}
    </div>
  );
}

