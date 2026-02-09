import { useEffect, useState, useRef } from 'react';
import { Plus, ExternalLink, Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useDepartmentPermissions } from '../../hooks/useDepartmentPermissions';

type ProfessionalNewsItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  tags: string[] | null;
  created_at: string;
};

type FormState = {
  title: string;
  description: string;
  url: string;
  image_url: string;
  tags: string;
};

export function ProfessionalNews() {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [items, setItems] = useState<ProfessionalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ProfessionalNewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    url: '',
    image_url: '',
    tags: '',
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = profile?.role === 'admin';

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setError(null);
    setForm({
      title: '',
      description: '',
      url: '',
      image_url: '',
      tags: '',
    });
    setSelectedImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showForm) {
        resetForm();
      }
    };

    if (showForm) {
      document.addEventListener('keydown', handleEscape);
      // Prevenir scroll del body cuando el modal está abierto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showForm]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_news')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as ProfessionalNewsItem[]);
    } catch (error) {
      console.error('Error al cargar novedades profesionales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const parseTags = (raw: string): string[] => {
    if (!raw) return [];
    return raw
      .split(/[,\s]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0)
      .slice(0, 5);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError('Por favor, selecciona una imagen válida (JPEG, PNG, GIF, WebP o SVG)');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5242880) {
      setError('La imagen no puede ser mayor a 5MB');
      return;
    }

    setSelectedImageFile(file);
    setError(null);
    // Limpiar URL cuando se selecciona un archivo
    handleChange('image_url', '');

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeSelectedImage = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImageFile || !profile?.id) return null;

    try {
      setUploadingImage(true);
      const fileExt = selectedImageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      // Subir a storage
      const { error: uploadError } = await supabase.storage
        .from('professional-news-images')
        .upload(filePath, selectedImageFile);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data } = supabase.storage
        .from('professional-news-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Error al subir imagen:', error);
      throw new Error(`Error al subir imagen: ${error?.message || 'Error desconocido'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url || !form.title) return;

    try {
      setSubmitting(true);
      setError(null);

      const { data: authUser } = await supabase.auth.getUser();
      const createdBy = authUser.user?.id || profile?.id || null;

      const tagsArray = parseTags(form.tags);

      // Si hay una imagen seleccionada, subirla primero
      let finalImageUrl = form.image_url;
      if (selectedImageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          throw new Error('No se pudo subir la imagen');
        }
      }

      if (!tenantId) {
        throw new Error('No se pudo identificar el tenant. Por favor, recarga la página.');
      }

      let data: ProfessionalNewsItem | null = null;
      let error;

      if (editingItem) {
        const result = await supabase
          .from('professional_news')
          .update({
            title: form.title,
            description: form.description || null,
            url: form.url,
            image_url: finalImageUrl || null,
            tags: tagsArray.length ? tagsArray : null,
            tenant_id: tenantId,
          })
          .eq('id', editingItem.id)
          .select('*')
          .maybeSingle();
        data = result.data as ProfessionalNewsItem | null;
        error = result.error;
      } else {
        const result = await supabase
          .from('professional_news')
          .insert({
            title: form.title,
            description: form.description || null,
            url: form.url,
            image_url: finalImageUrl || null,
            tags: tagsArray.length ? tagsArray : null,
            created_by: createdBy,
            tenant_id: tenantId,
          })
          .select('*')
          .maybeSingle();
        data = result.data as ProfessionalNewsItem | null;
        error = result.error;
      }

      if (error) throw error;

      if (data) {
        setItems((prev) => {
          if (editingItem) {
            return prev.map((item) => (item.id === data!.id ? data! : item));
          }
          return [data as ProfessionalNewsItem, ...prev];
        });
      }

      resetForm();
    } catch (error: any) {
      console.error('Error al guardar novedad profesional:', error);
      const errorMessage = error?.message || error?.details || error?.hint || 'Error desconocido al guardar la novedad profesional';
      setError(errorMessage);
      alert(`Error al guardar novedad profesional: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: ProfessionalNewsItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description || '',
      url: item.url,
      image_url: item.image_url || '',
      tags: (item.tags || [])
        .map((t) => (t.startsWith('#') ? t.substring(1) : t))
        .join(' '),
    });
    setSelectedImageFile(null);
    setImagePreview(item.image_url || null);
    setShowForm(true);
  };

  const handleDelete = async (item: ProfessionalNewsItem) => {
    const confirmed = window.confirm('¿Seguro que querés eliminar esta novedad?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('professional_news')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      setItems((prev) => prev.filter((n) => n.id !== item.id));
    } catch (error) {
      console.error('Error al eliminar novedad profesional:', error);
    }
  };

  const getFallbackImage = (title: string) => {
    const initials = title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');

    return (
      <div className="flex items-center justify-center h-40 sm:h-48 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 via-sky-400 to-emerald-400 text-white text-2xl sm:text-3xl md:text-4xl font-semibold">
        {initials || 'NP'}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">Novedades Profesionales</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Recursos externos y actualizaciones impositivas, laborales y contables para el equipo.
          </p>
        </div>

        {canCreate('professional-news') && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors text-sm sm:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Nueva novedad
          </button>
        )}
      </div>

      {showForm && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm();
            }
          }}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {editingItem ? 'Editar novedad profesional' : 'Agregar novedad profesional'}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sección 1: Información básica */}
                <div className="space-y-4">
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Información básica</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Título *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Monotributo Unificado CABA: AGIP actualiza montos a ingresar en 2026"
                        value={form.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Link de redirección *
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://www.somosemagroup.com/..."
                        value={form.url}
                        onChange={(e) => handleChange('url', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Descripción (opcional)
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Resumen breve de la novedad para que el equipo sepa de qué se trata."
                        value={form.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 2: Imagen */}
                <div className="space-y-4">
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Imagen</h3>
                  </div>
                  
                  {/* Preview de imagen */}
                  {imagePreview && (
                    <div className="relative">
                      <div className="relative w-full">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-48 sm:h-56 object-cover rounded-lg border-2 border-gray-300 dark:border-slate-600 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={removeSelectedImage}
                          className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                          title="Eliminar imagen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opción 1: Cargar archivo */}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        onChange={handleImageFileSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer text-sm font-medium transition-all"
                      >
                        <Upload className="w-5 h-5" />
                        {selectedImageFile ? 'Cambiar imagen' : 'Cargar desde archivo'}
                      </label>
                    </div>

                    {/* Opción 2: URL */}
                    <div>
                      <input
                        type="url"
                        placeholder="Pegar URL de imagen"
                        value={selectedImageFile ? '' : form.image_url}
                        onChange={(e) => {
                          if (!selectedImageFile) {
                            const url = e.target.value;
                            handleChange('image_url', url);
                            setImagePreview(url || null);
                            if (url) {
                              setSelectedImageFile(null);
                            }
                          }
                        }}
                        disabled={!!selectedImageFile}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Podés cargar una imagen desde tu computadora o pegar una URL. Máximo 5MB. Formatos: JPEG, PNG, GIF, WebP, SVG.
                  </p>
                </div>

                {/* Sección 3: Hashtags */}
                <div className="space-y-4">
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Hashtags (opcional)</h3>
                  </div>
                  
                  <div>
                    <input
                      type="text"
                      placeholder="#agip #monotributo o separados por coma: agip, monotributo"
                      value={form.tags}
                      onChange={(e) => handleChange('tags', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Podés escribir hasta 5 hashtags. Se mostrarán como chips amarillos en la tarjeta.
                    </p>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {(submitting || uploadingImage) ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{uploadingImage ? 'Subiendo imagen...' : 'Guardando...'}</span>
                      </>
                    ) : (
                      'Guardar novedad'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-slate-600 p-6 sm:p-8 md:p-10 text-center">
          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1.5 sm:mb-2">
            Todavía no hay novedades profesionales cargadas
          </p>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
            Usá este espacio para guardar links importantes de AGIP, AFIP, convenios, resoluciones, etc.
          </p>
          {canCreate('professional-news') && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Agregar primera novedad
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="group text-left bg-blue-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border border-transparent dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600 flex flex-col"
            >
              <button
                type="button"
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="w-full text-left"
              >
                <div className="mb-3 sm:mb-4 overflow-hidden rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-40 sm:h-48 object-cover"
                    onError={(e) => {
                      // Si la imagen remota falla, mostramos fallback
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  getFallbackImage(item.title)
                )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                  {(item.tags && item.tags.length > 0
                    ? item.tags
                    : ['Novedades', 'Profesionales']
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-yellow-300/90 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-gray-900 dark:text-white"
                    >
                      {tag.startsWith('#') ? tag.substring(1) : tag}
                    </span>
                  ))}
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-white mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-300 line-clamp-2">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 line-clamp-3">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 font-medium">
                  <span className="truncate max-w-[70%] sm:max-w-[75%]">
                    {new URL(item.url).hostname.replace('www.', '')}
                  </span>
                  <span className="inline-flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <span className="hidden sm:inline">Ver detalle</span>
                    <span className="sm:hidden">Ver</span>
                    <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </span>
                </div>
              </button>

              {(canEdit('professional-news') || canDelete('professional-news')) && (
                <div className="mt-2 sm:mt-3 flex items-center justify-end gap-1.5 sm:gap-2">
                  {canEdit('professional-news') && (
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      Editar
                    </button>
                  )}
                  {canDelete('professional-news') && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-red-500 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


