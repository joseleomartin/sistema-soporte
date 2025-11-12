#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import importlib.util
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Directorio de extractores
EXTRACTORES_DIR = Path(__file__).parent / 'extractores'
TEMP_DIR = Path(tempfile.gettempdir()) / 'extractores_temp'
TEMP_DIR.mkdir(exist_ok=True)

# Mapeo de bancos a sus extractores
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
}

def load_extractor_module(script_name):
    """Carga dinámicamente un módulo extractor"""
    script_path = EXTRACTORES_DIR / script_name
    spec = importlib.util.spec_from_file_location(script_name.replace('.py', ''), script_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud"""
    return jsonify({'status': 'ok'})

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
        pdf_path = TEMP_DIR / pdf_filename
        pdf_file.save(str(pdf_path))
        
        # Generar nombre del archivo Excel de salida
        excel_filename = pdf_filename.replace('.pdf', '_extraido.xlsx')
        excel_path = TEMP_DIR / excel_filename
        
        try:
            # Cargar el módulo extractor
            extractor_info = BANCO_EXTRACTORS[banco_id]
            module = load_extractor_module(extractor_info['script'])
            extractor_function = getattr(module, extractor_info['function'])
            
            # Ejecutar la extracción
            print(f"Extrayendo datos de {banco_id}...")
            df = extractor_function(str(pdf_path), str(excel_path))
            
            # Verificar que se generó el archivo Excel
            if not excel_path.exists():
                return jsonify({
                    'success': False,
                    'message': 'No se pudo generar el archivo Excel'
                }), 500
            
            # Obtener información del resultado
            rows = len(df) if df is not None and hasattr(df, '__len__') else 0

            base_url = request.host_url.rstrip('/')

            return jsonify({
                'success': True,
                'message': 'Extracción completada exitosamente',
                'filename': excel_filename,
                'rows': rows,
                'downloadUrl': f'{base_url}/download/{excel_filename}'
            })
            
        except Exception as e:
            print(f"Error durante la extracción: {str(e)}")
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
        pdf_path = TEMP_DIR / pdf_filename
        pdf_file.save(str(pdf_path))
        
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

if __name__ == '__main__':
    host = os.environ.get('EXTRACTOR_HOST', '0.0.0.0')
    # Railway usa la variable PORT, si no existe usa EXTRACTOR_PORT o 5000
    port = int(os.environ.get('PORT', os.environ.get('EXTRACTOR_PORT', '5000')))
    debug = os.environ.get('EXTRACTOR_DEBUG', 'false').lower() == 'true'

    print("=" * 50)
    print("Servidor de Extractores de Bancos")
    print("=" * 50)
    print(f"Extractores disponibles: {len(BANCO_EXTRACTORS)}")
    print(f"Directorio temporal: {TEMP_DIR}")
    print(f"Escuchando en http://{host}:{port}")
    print("=" * 50)
    app.run(host=host, port=port, debug=debug)

