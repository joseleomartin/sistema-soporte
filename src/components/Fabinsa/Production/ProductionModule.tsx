/**
 * Módulo de Producción
 * Gestión de órdenes de producción
 */

import { useState, useEffect } from 'react';
import { Factory, Plus, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';

type Product = Database['public']['Tables']['products']['Row'];
type ProductMaterial = Database['public']['Tables']['product_materials']['Row'];
type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];

export function ProductionModule() {
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Record<string, ProductMaterial[]>>({});
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadProducts();
      loadStockMaterials();
    }
  }, [tenantId]);

  const loadProducts = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);

      // Cargar materiales para cada producto
      for (const product of data || []) {
        const { data: mats } = await supabase
          .from('product_materials')
          .select('*')
          .eq('product_id', product.id);
        
        if (mats) {
          setMaterials(prev => ({ ...prev, [product.id]: mats }));
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStockMaterials = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('stock_materials')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setStockMaterials(data || []);
    } catch (error) {
      console.error('Error loading stock materials:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Producción</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gestión de órdenes de producción
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  PRODUCTO
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ESTADO
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  MATERIALES
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No hay órdenes de producción registradas</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const productMaterials = materials[product.id] || [];
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {product.nombre}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pendiente
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {productMaterials.length > 0 ? (
                            <div className="space-y-1">
                              {productMaterials.slice(0, 2).map((mat, idx) => (
                                <div key={idx} className="text-xs">
                                  • {mat.material_name} ({mat.kg_por_unidad} kg/unidad)
                                </div>
                              ))}
                              {productMaterials.length > 2 && (
                                <div className="text-xs text-gray-400">
                                  +{productMaterials.length - 2} más
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Sin materiales</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {canEdit('fabinsa-production') && (
                            <button
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Completar producción"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
