#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import importlib.util
from pathlib import Path
import sys
import requests

# Logging para diagnóstico
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Información de inicio
logger.info("=" * 60)
logger.info("SERVIDOR DE EXTRACTORES DE BANCOS - INICIANDO")
logger.info("=" * 60)
logger.info(f"Python Version: {sys.version}")
logger.info(f"Working Directory: {os.getcwd()}")
logger.info(f"Variable PORT: {os.environ.get('PORT', 'NO DEFINIDA')}")
logger.info(f"Variable EXTRACTOR_PORT: {os.environ.get('EXTRACTOR_PORT', 'NO DEFINIDA')}")

# Crear aplicación Flask
app = Flask(__name__)

# Configurar CORS - permitir todos los orígenes en producción
# Flask-CORS manejará los headers automáticamente, no agregar manualmente
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "ngrok-skip-browser-warning", "User-Agent"],
    "expose_headers": ["Content-Type"],
    "supports_credentials": True
}})

logger.info("Flask app creada correctamente")
logger.info("CORS configurado para permitir todos los orígenes")

# Middleware para logging de todas las peticiones
@app.before_request
def log_request_info():
    logger.info(f"Request recibido: {request.method} {request.path}")
    logger.info(f"Origin: {request.headers.get('Origin', 'No Origin')}")
    if request.method == 'POST':
        logger.info(f"Form data keys: {list(request.form.keys())}")
        logger.info(f"Files: {list(request.files.keys())}")

@app.after_request
def log_response_info(response):
    logger.info(f"Response enviado: {response.status_code} para {request.path}")
    # Flask-CORS ya maneja los headers CORS, no agregar manualmente para evitar duplicados
    return response

@app.route('/', methods=['GET'])
def root():
    """Endpoint raíz"""
    logger.info("Request recibido en endpoint raíz")
    try:
        response = jsonify({
            'message': 'Servidor de Extractores de Bancos',
            'status': 'running',
            'endpoints': {
                'health': '/health',
                'extractors': '/extractors',
                'extract': '/extract',
                'google_client_id': '/api/google/client-id',
                'google_oauth_token': '/api/google/oauth/token',
                'google_oauth_refresh': '/api/google/oauth/refresh'
            }
        })
        logger.info("Response enviado desde endpoint raíz")
        return response, 200
    except Exception as e:
        logger.error(f"Error en endpoint raíz: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# Directorio de extractores
EXTRACTORES_DIR = Path(__file__).parent / 'extractores'
TEMP_DIR = Path(tempfile.gettempdir()) / 'extractores_temp'
# Crear directorio temporal si no existe (con permisos completos)
try:
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Directorio temporal creado/verificado: {TEMP_DIR}")
except Exception as e:
    logger.error(f"Error al crear directorio temporal: {e}")
    # Fallback a directorio en la carpeta del proyecto
    TEMP_DIR = Path(__file__).parent / 'temp'
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Usando directorio temporal alternativo: {TEMP_DIR}")

logger.info(f"Directorio de extractores: {EXTRACTORES_DIR}")
logger.info(f"Directorio temporal: {TEMP_DIR}")
logger.info(f"Directorio de extractores existe: {EXTRACTORES_DIR.exists()}")

# Mapeo de bancos a sus extractores
logger.info("Cargando configuración de extractores...")
BANCO_EXTRACTORS = {
    'banco_galicia': {
        'script': 'extractor_banco_galicia.py',
        'function': 'extraer_datos_banco_galicia'
    },
    'banco_galicia_mas': {
        'script': 'extractor_banco_galicia_mas.py',
        'function': 'extraer_datos_banco_galicia_mas'
    },
    'mercado_pago': {
        'script': 'extractor_mercado_pago_directo.py',
        'function': 'extraer_datos_mercado_pago_directo'
    },
    'banco_comafi': {
        'script': 'extractor_banco_comafi.py',
        'function': 'extraer_datos_banco_comafi'
    },
    'banco_jpmorgan': {
        'script': 'extractor_banco_jpmorgan.py',
        'function': 'extraer_datos_banco_jpmorgan'
    },
    'banco_bind': {
        'script': 'extractor_banco_bind.py',
        'function': 'extraer_datos_banco_bind'
    },
    'banco_supervielle': {
        'script': 'extractor_banco_supervielle.py',
        'function': 'extraer_datos_banco_supervielle'
    },
    'banco_cabal': {
        'script': 'extractor_banco_cabal.py',
        'function': 'extraer_datos_banco_cabal'
    },
    'banco_credicoop': {
        'script': 'extractor_banco_credicoop_v3.py',
        'function': 'extraer_datos_banco_credicoop'
    },
    'banco_cmf': {
        'script': 'extractor_banco_cmf.py',
        'function': 'extraer_datos_banco_cmf'
    },
    'banco_santander': {
        'script': 'extractor_santander_simple.py',
        'function': 'extraer_datos_santander_v3'
    },
    'banco_del_sol': {
        'script': 'extractor_banco_del_sol_v1.py',
        'function': 'extraer_datos_banco_del_sol_v1'
    },
    'banco_ciudad': {
        'script': 'extractor_banco_ciudad.py',
        'function': 'extraer_datos_banco_ciudad'
    },
    'banco_bbva': {
        'script': 'extractor_bbva_mejorado.py',
        'function': 'extraer_datos_bbva'
    },
    'banco_icbc': {
        'script': 'extractor_banco_icbc.py',
        'function': 'extraer_datos_banco_icbc'
    },
    'banco_macro': {
        'script': 'extractor_banco_macro.py',
        'function': 'extraer_datos_banco_macro'
    },
    'banco_nacion': {
        'script': 'nacion.py',
        'function': 'extraer_datos_banco_nacion'
    },
    'colppy': {
        'script': 'Colppy.py',
        'function': 'extraer_datos_colppy'
    },
}

logger.info(f"Extractores configurados: {len(BANCO_EXTRACTORS)}")
logger.info("Aplicación Flask inicializada correctamente")

def load_extractor_module(script_name):
    """Carga dinámicamente un módulo extractor"""
    script_path = EXTRACTORES_DIR / script_name
    
    if not script_path.exists():
        raise FileNotFoundError(f"El archivo extractor no existe: {script_path}")
    
    logger.info(f"Cargando módulo desde: {script_path}")
    
    try:
        spec = importlib.util.spec_from_file_location(script_name.replace('.py', ''), script_path)
        if spec is None:
            raise ImportError(f"No se pudo crear el spec para {script_name}")
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        logger.info(f"Módulo {script_name} cargado exitosamente")
        return module
    except Exception as e:
        logger.error(f"Error cargando módulo {script_name}: {str(e)}", exc_info=True)
        raise

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud"""
    try:
        logger.info("Health check recibido")
        port = os.environ.get('PORT', os.environ.get('EXTRACTOR_PORT', 'NO DEFINIDA'))
        response = jsonify({
            'status': 'ok',
            'message': 'Servidor funcionando correctamente',
            'extractors_count': len(BANCO_EXTRACTORS),
            'port': port,
            'host': request.host,
            'remote_addr': request.remote_addr
        })
        logger.info("Health check respondido exitosamente")
        return response, 200
    except Exception as e:
        logger.error(f"Error en health check: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/extractors', methods=['GET'])
def list_extractors():
    """Lista todos los extractores disponibles"""
    return jsonify({
        'extractors': list(BANCO_EXTRACTORS.keys()),
        'count': len(BANCO_EXTRACTORS)
    })

@app.route('/extract', methods=['POST'])
def extract():
    """Endpoint principal para extraer datos"""
    try:
        # Validar que se recibió el archivo y el banco
        if 'pdf' not in request.files:
            return jsonify({'success': False, 'message': 'No se recibió ningún archivo PDF'}), 400
        
        if 'banco' not in request.form:
            return jsonify({'success': False, 'message': 'No se especificó el banco'}), 400
        
        pdf_file = request.files['pdf']
        banco_id = request.form['banco']
        
        # Validar que el banco existe
        if banco_id not in BANCO_EXTRACTORS:
            return jsonify({'success': False, 'message': f'Banco no soportado: {banco_id}'}), 400
        
        # Guardar el PDF temporalmente
        pdf_filename = f"{banco_id}_{pdf_file.filename}"
        # Limpiar nombre de archivo (remover caracteres problemáticos)
        pdf_filename = pdf_filename.replace(' ', '_').replace('/', '_').replace('\\', '_')
        pdf_path = TEMP_DIR / pdf_filename
        
        # Asegurar que el directorio existe
        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        
        # Guardar archivo
        pdf_file.save(str(pdf_path))
        logger.info(f"PDF guardado temporalmente en: {pdf_path}")
        
        # Generar nombre del archivo Excel de salida
        excel_filename = pdf_filename.replace('.pdf', '_extraido.xlsx')
        excel_path = TEMP_DIR / excel_filename
        
        try:
            # Cargar el módulo extractor
            extractor_info = BANCO_EXTRACTORS[banco_id]
            logger.info(f"Cargando extractor: {extractor_info['script']}")
            
            try:
                module = load_extractor_module(extractor_info['script'])
            except Exception as load_error:
                logger.error(f"Error cargando módulo {extractor_info['script']}: {str(load_error)}", exc_info=True)
                return jsonify({
                    'success': False,
                    'message': f'Error al cargar el extractor: {str(load_error)}'
                }), 500
            
            try:
                extractor_function = getattr(module, extractor_info['function'])
            except AttributeError as attr_error:
                logger.error(f"Función {extractor_info['function']} no encontrada en {extractor_info['script']}: {str(attr_error)}")
                return jsonify({
                    'success': False,
                    'message': f'Función {extractor_info["function"]} no encontrada en el extractor'
                }), 500
            
            # Ejecutar la extracción
            logger.info(f"Extrayendo datos de {banco_id}...")
            try:
                df = extractor_function(str(pdf_path), str(excel_path))
            except Exception as extract_error:
                logger.error(f"Error durante la extracción: {str(extract_error)}", exc_info=True)
                return jsonify({
                    'success': False,
                    'message': f'Error al extraer datos: {str(extract_error)}'
                }), 500
            
            # Verificar que se generó el archivo Excel
            if not excel_path.exists():
                logger.warning(f"El archivo Excel no se generó en: {excel_path}")
                return jsonify({
                    'success': False,
                    'message': 'No se pudo generar el archivo Excel'
                }), 500
            
            # Obtener información del resultado
            rows = len(df) if df is not None and hasattr(df, '__len__') else 0
            logger.info(f"Extracción completada: {rows} filas extraídas")

            base_url = request.host_url.rstrip('/')

            return jsonify({
                'success': True,
                'message': 'Extracción completada exitosamente',
                'filename': excel_filename,
                'rows': rows,
                'downloadUrl': f'{base_url}/download/{excel_filename}'
            })
            
        except Exception as e:
            logger.error(f"Error durante la extracción: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'message': f'Error al procesar el PDF: {str(e)}'
            }), 500
        
        finally:
            # Limpiar el PDF temporal
            if pdf_path.exists():
                try:
                    pdf_path.unlink()
                except Exception as e:
                    print(f"Error al eliminar PDF temporal: {e}")
    
    except Exception as e:
        print(f"Error general: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error del servidor: {str(e)}'
        }), 500

@app.route('/pdf-to-ocr', methods=['POST'])
def pdf_to_ocr():
    """Endpoint para convertir PDF escaneado a PDF con OCR"""
    try:
        # Validar que se recibió el archivo
        if 'pdf' not in request.files:
            return jsonify({'success': False, 'message': 'No se recibió ningún archivo PDF'}), 400
        
        pdf_file = request.files['pdf']
        
        # Guardar el PDF temporalmente
        pdf_filename = f"ocr_input_{pdf_file.filename}"
        # Limpiar nombre de archivo (remover caracteres problemáticos)
        pdf_filename = pdf_filename.replace(' ', '_').replace('/', '_').replace('\\', '_')
        pdf_path = TEMP_DIR / pdf_filename
        
        # Asegurar que el directorio existe
        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        
        # Guardar archivo
        pdf_file.save(str(pdf_path))
        logger.info(f"PDF guardado temporalmente en: {pdf_path}")
        
        # Generar nombre del archivo PDF de salida
        output_filename = pdf_filename.replace('ocr_input_', 'ocr_output_').replace('.pdf', '_OCR.pdf')
        output_path = TEMP_DIR / output_filename
        
        try:
            # Cargar el módulo extractor de OCR
            import sys
            sys.path.insert(0, str(EXTRACTORES_DIR))
            from extractor_pdf_ocr import extraer_texto_pdf_ocr
            
            # Ejecutar la conversión OCR
            print(f"Convirtiendo PDF a OCR: {pdf_filename}...")
            success = extraer_texto_pdf_ocr(str(pdf_path), str(output_path))
            
            # Verificar que se generó el archivo
            if not output_path.exists():
                return jsonify({
                    'success': False,
                    'message': 'No se pudo generar el archivo PDF con OCR'
                }), 500
            
            base_url = request.host_url.rstrip('/')

            return jsonify({
                'success': True,
                'message': 'Conversión OCR completada exitosamente',
                'filename': output_filename,
                'downloadUrl': f'{base_url}/download-pdf/{output_filename}'
            })
            
        except Exception as e:
            print(f"Error durante la conversión OCR: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Error al procesar el PDF: {str(e)}'
            }), 500
        
        finally:
            # Limpiar el PDF temporal de entrada
            if pdf_path.exists():
                try:
                    pdf_path.unlink()
                except Exception as e:
                    print(f"Error al eliminar PDF temporal: {e}")
    
    except Exception as e:
        print(f"Error general: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error del servidor: {str(e)}'
        }), 500

@app.route('/download/<filename>', methods=['GET'])
def download(filename):
    """Endpoint para descargar archivos Excel generados"""
    try:
        file_path = TEMP_DIR / filename
        
        if not file_path.exists():
            return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
        return send_file(
            str(file_path),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/download-pdf/<filename>', methods=['GET'])
def download_pdf(filename):
    """Endpoint para descargar archivos PDF generados"""
    try:
        file_path = TEMP_DIR / filename
        
        if not file_path.exists():
            return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
        return send_file(
            str(file_path),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/cleanup', methods=['POST'])
def cleanup():
    """Limpia archivos temporales antiguos"""
    try:
        import time
        cleaned = 0
        now = time.time()
        
        for file in TEMP_DIR.glob('*'):
            if file.is_file():
                # Eliminar archivos más antiguos de 1 hora
                if now - file.stat().st_mtime > 3600:
                    file.unlink()
                    cleaned += 1
        
        return jsonify({
            'success': True,
            'message': f'Se limpiaron {cleaned} archivos'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/google/oauth/token', methods=['POST'])
def exchange_google_token():
    """Intercambia código de autorización por token de acceso"""
    try:
        logger.info("Request recibido en /api/google/oauth/token")
        data = request.json
        
        if not data:
            logger.error("No se recibió JSON en el request")
            return jsonify({'error': 'Se requiere JSON en el body'}), 400
        
        code = data.get('code')
        redirect_uri = data.get('redirect_uri')
        
        if not code or not redirect_uri:
            logger.error(f"Faltan parámetros: code={bool(code)}, redirect_uri={bool(redirect_uri)}")
            return jsonify({'error': 'code y redirect_uri son requeridos'}), 400
        
        # Obtener credenciales desde variables de entorno del backend
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            logger.error("Credenciales de Google no configuradas en variables de entorno")
            return jsonify({
                'error': 'Credenciales de Google no configuradas',
                'message': 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno del backend'
            }), 500
        
        logger.info(f"Intercambiando código por token (redirect_uri: {redirect_uri})")
        
        # Intercambiar código por token
        token_response = requests.post('https://oauth2.googleapis.com/token', data={
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        })
        
        if token_response.status_code != 200:
            try:
                error_data = token_response.json()
                logger.error(f"Error de Google OAuth: {error_data}")
                # Incluir información adicional para debugging
                error_data['debug_info'] = {
                    'client_id_configured': bool(client_id),
                    'client_secret_configured': bool(client_secret),
                    'redirect_uri_used': redirect_uri,
                }
                return jsonify(error_data), token_response.status_code
            except:
                # Si no se puede parsear JSON, devolver el texto
                logger.error(f"Error de Google OAuth (no JSON): {token_response.text}")
                return jsonify({
                    'error': 'oauth_error',
                    'error_description': token_response.text[:200],
                    'status_code': token_response.status_code
                }), token_response.status_code
        
        token_data = token_response.json()
        logger.info("Token obtenido exitosamente")
        
        return jsonify(token_data), 200
        
    except Exception as e:
        logger.error(f"Error en exchange_google_token: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/google/oauth/refresh', methods=['POST'])
def refresh_google_token():
    """Refresca un token de acceso usando refresh token"""
    try:
        logger.info("Request recibido en /api/google/oauth/refresh")
        data = request.json
        
        if not data:
            logger.error("No se recibió JSON en el request")
            return jsonify({'error': 'Se requiere JSON en el body'}), 400
        
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            logger.error("No se recibió refresh_token")
            return jsonify({'error': 'refresh_token es requerido'}), 400
        
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            logger.error("Credenciales de Google no configuradas en variables de entorno")
            return jsonify({
                'error': 'Credenciales de Google no configuradas',
                'message': 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno del backend'
            }), 500
        
        logger.info("Refrescando token de acceso")
        
        token_response = requests.post('https://oauth2.googleapis.com/token', data={
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
        })
        
        if token_response.status_code != 200:
            error_data = token_response.json()
            logger.error(f"Error al refrescar token: {error_data}")
            return jsonify(error_data), token_response.status_code
        
        token_data = token_response.json()
        logger.info("Token refrescado exitosamente")
        
        return jsonify(token_data), 200
        
    except Exception as e:
        logger.error(f"Error en refresh_google_token: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/google/client-id', methods=['GET'])
def get_google_client_id():
    """Devuelve el Client ID de Google (sin el secret)"""
    try:
        logger.info("Request recibido en /api/google/client-id")
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        
        if not client_id:
            logger.error("GOOGLE_CLIENT_ID no configurado en variables de entorno")
            return jsonify({
                'error': 'Client ID no configurado',
                'message': 'Configura GOOGLE_CLIENT_ID en las variables de entorno del backend'
            }), 500
        
        logger.info("Client ID devuelto exitosamente")
        # Solo devolvemos el Client ID, nunca el secret
        return jsonify({'client_id': client_id}), 200
        
    except Exception as e:
        logger.error(f"Error en get_google_client_id: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # NOTA: Este bloque SOLO se ejecuta cuando se corre directamente con python server.py
    # Railway/Gunicorn NO ejecuta este bloque, importa la app directamente
    
    host = os.environ.get('EXTRACTOR_HOST', '0.0.0.0')
    # Railway usa la variable PORT, si no existe usa EXTRACTOR_PORT o 5000
    port = int(os.environ.get('PORT', os.environ.get('EXTRACTOR_PORT', '5000')))
    debug = os.environ.get('EXTRACTOR_DEBUG', 'false').lower() == 'true'

    logger.info("=" * 50)
    logger.info("MODO DESARROLLO - Servidor Flask Directo")
    logger.info("=" * 50)
    logger.info(f"Extractores disponibles: {len(BANCO_EXTRACTORS)}")
    logger.info(f"Directorio temporal: {TEMP_DIR}")
    logger.info(f"Escuchando en http://{host}:{port}")
    logger.info(f"Debug mode: {debug}")
    logger.info("=" * 50)
    logger.warning("ADVERTENCIA: En producción usa Gunicorn, no este modo")
    
    # Deshabilitar carga automática de .env para evitar errores de codificación
    # Flask 3.0 intenta cargar .env automáticamente, pero si el archivo está corrupto falla
    # Las variables de entorno se pueden configurar manualmente o en el sistema
    try:
        # Intentar deshabilitar la carga de .env
        import flask.cli
        original_load_dotenv = flask.cli.load_dotenv
        flask.cli.load_dotenv = lambda *args, **kwargs: None
    except Exception as e:
        logger.warning(f"No se pudo deshabilitar load_dotenv: {e}")
    
    try:
        app.run(host=host, port=port, debug=debug)
    finally:
        # Restaurar función original si fue modificada
        try:
            flask.cli.load_dotenv = original_load_dotenv
        except:
            pass

