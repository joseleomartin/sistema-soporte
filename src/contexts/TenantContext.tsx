import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Record<string, any>;
  visible_modules: Record<string, boolean> | null;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = async () => {
    if (!profile?.tenant_id) {
      setTenant(null);
      setTenantId(null);
      setLoading(false);
      return;
    }

    try {
      setTenantId(profile.tenant_id);

      // Cargar información del tenant
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .maybeSingle();

      if (error) {
        console.error('Error loading tenant:', error);
        setTenant(null);
        setLoading(false);
        return;
      }

      if (data) {
        setTenant(data);
      } else {
        setTenant(null);
      }
    } catch (error) {
      console.error('Error loading tenant:', error);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
  }, [profile?.tenant_id]);

  const refreshTenant = async () => {
    await loadTenant();
  };

  const value = {
    tenant,
    tenantId,
    loading,
    refreshTenant,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

