/**
 * Google Drive API
 * Funciones para interactuar con Google Drive API
 */

import { getAccessToken } from './googleAuthRedirect';

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
  iconLink?: string;
  isFolder?: boolean;
  folderPath?: string; // Ruta de la carpeta donde está el archivo
  parentFolderId?: string; // ID de la carpeta padre
}

export interface DriveFolderContent {
  files: DriveFile[];
  folders: DriveFile[];
}

interface DriveAPIResponse {
  files: any[];
  nextPageToken?: string;
}

/**
 * Busca carpetas por nombre (búsqueda exacta y parcial)
 */
export async function searchFoldersByName(
  folderName: string,
  accessToken: string
): Promise<DriveFolder[]> {
  try {
    // Búsqueda exacta primero
    const exactQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const exactResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(exactQuery)}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!exactResponse.ok) {
      throw new Error(`Error en búsqueda exacta: ${exactResponse.statusText}`);
    }

    const exactData: DriveAPIResponse = await exactResponse.json();
    const exactFolders: DriveFolder[] = (exactData.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
    }));

    // Búsqueda parcial
    const partialQuery = `name contains '${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const partialResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(partialQuery)}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!partialResponse.ok) {
      throw new Error(`Error en búsqueda parcial: ${partialResponse.statusText}`);
    }

    const partialData: DriveAPIResponse = await partialResponse.json();
    const partialFolders: DriveFolder[] = (partialData.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
    }));

    // Combinar resultados: exactas primero, luego parciales (sin duplicados)
    const folderMap = new Map<string, DriveFolder>();
    
    // Agregar exactas primero
    exactFolders.forEach((folder) => {
      folderMap.set(folder.id, folder);
    });

    // Agregar parciales (sin duplicar)
    partialFolders.forEach((folder) => {
      if (!folderMap.has(folder.id)) {
        folderMap.set(folder.id, folder);
      }
    });

    return Array.from(folderMap.values()).slice(0, 10);
  } catch (error: any) {
    console.error('Error buscando carpetas:', error);
    throw new Error(`Error al buscar carpetas: ${error.message || 'Error desconocido'}`);
  }
}

/**
 * Búsqueda general de carpetas con paginación
 */
export async function searchAllFolders(
  searchTerm: string,
  accessToken: string,
  pageToken?: string
): Promise<{ folders: DriveFolder[]; nextPageToken?: string }> {
  try {
    const query = searchTerm
      ? `name contains '${searchTerm}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      : `mimeType='application/vnd.google-apps.folder' and trashed=false`;

    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,webViewLink),nextPageToken&orderBy=modifiedTime desc&pageSize=20`;

    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
      throw new Error(`Error en búsqueda: ${response.statusText}`);
    }

    const data: DriveAPIResponse = await response.json();

    const folders: DriveFolder[] = (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
    }));

    return {
      folders,
      nextPageToken: data.nextPageToken,
    };
  } catch (error: any) {
    console.error('Error buscando carpetas:', error);
    throw error;
  }
}

/**
 * Lista archivos y carpetas de una carpeta
 */
export async function listFilesInFolder(
  folderId: string,
  accessToken: string,
  pageToken?: string
): Promise<DriveFolderContent> {
  try {
    const query = `'${folderId}' in parents and trashed=false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,iconLink),nextPageToken&orderBy=name&pageSize=1000`;
    
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          'Carpeta no encontrada. Puede que no exista o no tengas permisos para acceder a ella.'
        );
      }
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          'No tienes permisos para acceder a esta carpeta.'
        );
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `Error al listar archivos: ${response.statusText}`
      );
    }

    const data: DriveAPIResponse = await response.json();

    const allItems: DriveFile[] = (data.files || []).map((file: any) => {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        thumbnailLink: file.thumbnailLink,
        iconLink: file.iconLink,
        isFolder,
      };
    });

    // Separar carpetas y archivos
    const folders = allItems.filter(item => item.isFolder);
    const files = allItems.filter(item => !item.isFolder);

    return { folders, files };
  } catch (error: any) {
    console.error('Error listando archivos:', error);
    throw error;
  }
}

/**
 * Busca archivos y carpetas recursivamente dentro de una carpeta raíz
 * Usa búsqueda paralela para mejorar el rendimiento
 */
export async function searchFilesRecursively(
  rootFolderId: string,
  searchTerm: string,
  accessToken: string
): Promise<{ folders: DriveFile[]; files: DriveFile[] }> {
  try {
    const searchLower = searchTerm.toLowerCase();
    const allFolders: DriveFile[] = [];
    const allFiles: DriveFile[] = [];
    const visitedFolders = new Set<string>(); // Para evitar loops
    const MAX_DEPTH = 5; // Reducir profundidad máxima
    const MAX_FOLDERS = 100; // Límite de carpetas a visitar

    // Función recursiva para buscar en una carpeta y sus subcarpetas (en paralelo)
    const searchInFolder = async (folderId: string, depth: number = 0): Promise<void> => {
      // Evitar loops, profundidad excesiva y límite de carpetas
      if (visitedFolders.has(folderId) || depth > MAX_DEPTH || visitedFolders.size >= MAX_FOLDERS) {
        return;
      }
      visitedFolders.add(folderId);

      try {
        // Listar archivos y carpetas en esta carpeta
        const content = await listFilesInFolder(folderId, accessToken);
        
        // Filtrar carpetas que coincidan con la búsqueda
        const matchingFolders = content.folders.filter(folder =>
          folder.name.toLowerCase().includes(searchLower)
        );
        
        // Filtrar archivos que coincidan con la búsqueda
        const matchingFiles = content.files.filter(file =>
          file.name.toLowerCase().includes(searchLower)
        );
        
        // Agregar resultados encontrados
        allFolders.push(...matchingFolders);
        allFiles.push(...matchingFiles);
        
        // Si ya visitamos muchas carpetas, no seguir buscando
        if (visitedFolders.size >= MAX_FOLDERS) {
          return;
        }
        
        // Buscar recursivamente en cada subcarpeta EN PARALELO (hasta 5 a la vez)
        const subfolderPromises: Promise<void>[] = [];
        const batchSize = 5; // Procesar 5 carpetas en paralelo
        
        for (let i = 0; i < content.folders.length; i += batchSize) {
          const batch = content.folders.slice(i, i + batchSize);
          const batchPromises = batch.map(subfolder => 
            searchInFolder(subfolder.id, depth + 1)
          );
          subfolderPromises.push(...batchPromises);
          
          // Esperar a que termine este batch antes de continuar
          await Promise.all(batchPromises);
        }
      } catch (err: any) {
        console.warn(`Error buscando en carpeta ${folderId}:`, err);
        // Continuar con otras carpetas aunque una falle
      }
    };

    // Iniciar búsqueda desde la carpeta raíz
    await searchInFolder(rootFolderId);

    return { folders: allFolders, files: allFiles };
  } catch (error: any) {
    console.error('Error en búsqueda recursiva:', error);
    throw error;
  }
}

/**
 * Descarga un archivo de Google Drive
 */
export async function downloadFileFromDrive(
  fileId: string,
  fileName: string,
  accessToken: string
): Promise<void> {
  try {
    // Obtener el archivo como blob
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
      throw new Error(`Error al descargar archivo: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // Limpiar
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Error descargando archivo:', error);
    throw error;
  }
}

/**
 * Obtiene información de una carpeta por su ID
 */
export async function getFolderInfo(
  folderId: string,
  accessToken: string
): Promise<DriveFolder> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,modifiedTime,webViewLink`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          'Carpeta no encontrada. Puede que no exista o no tengas permisos para acceder a ella.'
        );
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `Error al obtener información de carpeta: ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      modifiedTime: data.modifiedTime,
      webViewLink: data.webViewLink,
    };
  } catch (error: any) {
    console.error('Error obteniendo información de carpeta:', error);
    throw error;
  }
}

/**
 * Sube un archivo a Google Drive
 */
export async function uploadFileToDrive(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (progress: number) => void
): Promise<DriveFile> {
  try {
    const fileSize = file.size;
    const CHUNK_SIZE = 256 * 1024; // 256KB
    const USE_RESUMABLE = fileSize >= 5 * 1024 * 1024; // 5MB

    if (USE_RESUMABLE) {
      // Resumable upload para archivos grandes
      return await uploadFileResumable(file, folderId, accessToken, onProgress);
    } else {
      // Multipart upload para archivos pequeños
      return await uploadFileMultipart(file, folderId, accessToken, onProgress);
    }
  } catch (error: any) {
    console.error('Error subiendo archivo:', error);
    throw new Error(`Error al subir archivo: ${error.message || 'Error desconocido'}`);
  }
}

/**
 * Multipart upload (archivos < 5MB)
 */
async function uploadFileMultipart(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (progress: number) => void
): Promise<DriveFile> {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        onProgress?.(100);
        resolve({
          id: response.id,
          name: response.name,
          mimeType: response.mimeType,
          size: response.size,
          modifiedTime: response.modifiedTime,
          webViewLink: response.webViewLink,
          thumbnailLink: response.thumbnailLink,
          iconLink: response.iconLink,
        });
      } else {
        reject(new Error(`Error al subir archivo: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Error de red al subir archivo'));
    });

    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send(form);
  });
}

/**
 * Resumable upload (archivos >= 5MB)
 */
async function uploadFileResumable(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (progress: number) => void
): Promise<DriveFile> {
  // Paso 1: Iniciar sesión de carga
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initResponse.ok) {
    throw new Error(`Error al iniciar carga: ${initResponse.statusText}`);
  }

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('No se recibió URL de carga');
  }

  // Paso 2: Subir archivo en chunks
  const CHUNK_SIZE = 256 * 1024; // 256KB
  let uploadedBytes = 0;
  const totalBytes = file.size;

  while (uploadedBytes < totalBytes) {
    const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, totalBytes);
    const chunk = file.slice(uploadedBytes, chunkEnd);

    const chunkResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${uploadedBytes}-${chunkEnd - 1}/${totalBytes}`,
        'Content-Type': file.type,
      },
      body: chunk,
    });

    if (chunkResponse.status === 308) {
      // Continuar subiendo
      uploadedBytes = chunkEnd;
      if (onProgress) {
        onProgress(Math.round((uploadedBytes / totalBytes) * 100));
      }
    } else if (chunkResponse.ok) {
      // Carga completada
      const response = await chunkResponse.json();
      onProgress?.(100);
      return {
        id: response.id,
        name: response.name,
        mimeType: response.mimeType,
        size: response.size,
        modifiedTime: response.modifiedTime,
        webViewLink: response.webViewLink,
        thumbnailLink: response.thumbnailLink,
        iconLink: response.iconLink,
      };
    } else {
      throw new Error(`Error al subir chunk: ${chunkResponse.statusText}`);
    }
  }

  throw new Error('Error inesperado en carga resumable');
}

/**
 * Crea una carpeta en Google Drive
 */
export async function createFolder(
  folderName: string,
  parentFolderId: string,
  accessToken: string
): Promise<DriveFile> {
  try {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
      if (response.status === 403) {
        throw new Error('No tienes permisos para crear carpetas en esta ubicación.');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error al crear carpeta: ${errorData.error?.message || response.statusText}`);
    }

    const folderData = await response.json();
    
    return {
      id: folderData.id,
      name: folderData.name,
      mimeType: folderData.mimeType,
      modifiedTime: folderData.modifiedTime,
      webViewLink: folderData.webViewLink,
      isFolder: true,
    };
  } catch (error: any) {
    console.error('Error creando carpeta:', error);
    throw error;
  }
}

/**
 * Elimina un archivo de Google Drive (opcional)
 */
export async function deleteFileFromDrive(
  fileId: string,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
      throw new Error(`Error al eliminar archivo: ${response.statusText}`);
    }
  } catch (error: any) {
    console.error('Error eliminando archivo:', error);
    throw error;
  }
}

