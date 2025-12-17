import { useEffect, useState } from 'react';
import { Plus, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  const [items, setItems] = useState<ProfessionalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ProfessionalNewsItem | null>(null);
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    url: '',
    image_url: '',
    tags: '',
  });
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchNews();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url || !form.title) return;

    try {
      setSubmitting(true);

      const { data: authUser } = await supabase.auth.getUser();
      const createdBy = authUser.user?.id || profile?.id || null;

      const tagsArray = parseTags(form.tags);

      let data: ProfessionalNewsItem | null = null;
      let error;

      if (editingItem) {
        const result = await supabase
          .from('professional_news')
          .update({
            title: form.title,
            description: form.description || null,
            url: form.url,
            image_url: form.image_url || null,
            tags: tagsArray.length ? tagsArray : null,
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
            image_url: form.image_url || null,
            tags: tagsArray.length ? tagsArray : null,
            created_by: createdBy,
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

      setForm({
        title: '',
        description: '',
        url: '',
        image_url: '',
        tags: '',
      });
      setEditingItem(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error al guardar novedad profesional:', error);
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
      <div className="flex items-center justify-center h-48 rounded-2xl bg-gradient-to-br from-blue-500 via-sky-400 to-emerald-400 text-white text-4xl font-semibold">
        {initials || 'NP'}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Novedades Profesionales</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Recursos externos y actualizaciones impositivas, laborales y contables para el equipo.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nueva novedad
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingItem ? 'Editar novedad profesional' : 'Agregar novedad profesional'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link de redirección *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.somosemagroup.com/..."
                  value={form.url}
                  onChange={(e) => handleChange('url', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Monotributo Unificado CABA: AGIP actualiza montos a ingresar en 2026"
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Resumen breve de la novedad para que el equipo sepa de qué se trata."
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Imagen (URL opcional)
                </label>
                <input
                  type="url"
                  placeholder="Si la dejás vacía, mostraremos una tarjeta con fondo de color."
                  value={form.image_url}
                  onChange={(e) => handleChange('image_url', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Idealmente podés pegar la URL de la imagen principal de la nota (por ejemplo la de AGIP).
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hashtags (opcional)
              </label>
              <input
                type="text"
                placeholder="#agip #monotributo o separados por coma: agip, monotributo"
                value={form.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Podés escribir hasta 5 hashtags. Se mostrarán como chips amarillos en la tarjeta.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                  setForm({
                    title: '',
                    description: '',
                    url: '',
                    image_url: '',
                    tags: '',
                  });
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar novedad'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-slate-600 p-10 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Todavía no hay novedades profesionales cargadas
          </p>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Usá este espacio para guardar links importantes de AGIP, AFIP, convenios, resoluciones, etc.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              <Plus className="w-5 h-5" />
              Agregar primera novedad
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="group text-left bg-blue-50 dark:bg-slate-800 rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border border-transparent dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600 flex flex-col"
            >
              <button
                type="button"
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="w-full text-left"
              >
                <div className="mb-4 overflow-hidden rounded-2xl bg-white dark:bg-slate-800">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-48 object-cover"
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

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {(item.tags && item.tags.length > 0
                    ? item.tags
                    : ['Novedades', 'Profesionales']
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-yellow-300/90 px-3 py-1 text-xs font-semibold text-gray-900 dark:text-white"
                    >
                      {tag.startsWith('#') ? tag.substring(1) : tag}
                    </span>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-blue-900 dark:text-white mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-300 line-clamp-2">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
                  <span className="truncate max-w-[75%]">
                    {new URL(item.url).hostname.replace('www.', '')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    Ver detalle
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </button>

              {isAdmin && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="text-xs px-3 py-1 rounded-full border border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-xs px-3 py-1 rounded-full border border-red-500 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


