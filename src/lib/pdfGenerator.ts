/**
 * Utilidad para generar PDFs de órdenes
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface OrderItem {
  producto?: string;
  material?: string;
  tipo?: string;
  cantidad: number;
  precio_unitario?: number;
  precio_lista?: number; // Precio de lista (antes de descuentos)
  descuento_pct?: number; // Porcentaje de descuento
  costo_unitario?: number;
  ingreso_neto?: number;
  ganancia_total?: number;
  precio?: number;
  total?: number;
  moneda?: string;
  valor_dolar?: number;
}

export interface ClientData {
  nombre?: string;
  razon_social?: string | null;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  provincia?: string | null;
  direccion?: string | null;
  observaciones?: string | null;
}

export interface OrderData {
  tipo: 'venta' | 'compra' | 'produccion';
  fecha: string;
  cliente?: string;
  clienteData?: ClientData;
  proveedor?: string;
  order_id?: string;
  order_number?: number;
  items: OrderItem[];
  total_ingreso_neto?: number;
  total_ganancia?: number;
  total_compra?: number;
  nombre?: string;
  familia?: string;
  medida?: string;
  caracteristica?: string;
  cantidad_fabricar?: number;
  costo_mp?: number;
  costo_mo?: number;
  costo_total?: number;
  logoUrl?: string;
  companyName?: string;
}

export async function generateOrderPDF(order: OrderData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Logo de la empresa (si está disponible)
  if (order.logoUrl) {
    try {
      // Cargar imagen desde URL usando fetch para evitar problemas de CORS
      const response = await fetch(order.logoUrl);
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        
        await new Promise((resolve, reject) => {
          reader.onload = () => {
            try {
              const imgData = reader.result as string;
              const img = new Image();
              
              img.onload = () => {
                try {
                  // Redimensionar logo si es muy grande (máximo 50px de alto)
                  const maxHeight = 50;
                  const maxWidth = 150;
                  let logoWidth = img.width;
                  let logoHeight = img.height;
                  
                  if (logoHeight > maxHeight) {
                    const ratio = maxHeight / logoHeight;
                    logoHeight = maxHeight;
                    logoWidth = logoWidth * ratio;
                  }
                  
                  if (logoWidth > maxWidth) {
                    const ratio = maxWidth / logoWidth;
                    logoWidth = maxWidth;
                    logoHeight = logoHeight * ratio;
                  }
                  
                  // Agregar logo en la parte superior izquierda
                  doc.addImage(imgData, 'PNG', margin, yPos, logoWidth, logoHeight);
                  yPos += logoHeight + 10;
                } catch (error) {
                  console.error('Error adding logo to PDF:', error);
                  yPos += 10;
                }
                resolve(null);
              };
              
              img.onerror = () => {
                console.error('Error loading logo image');
                yPos += 10;
                resolve(null);
              };
              
              img.src = imgData;
            } catch (error) {
              console.error('Error processing logo:', error);
              yPos += 10;
              resolve(null);
            }
          };
          
          reader.onerror = () => {
            console.error('Error reading logo file');
            yPos += 10;
            resolve(null);
          };
          
          reader.readAsDataURL(blob);
        });
      } else {
        console.error('Error fetching logo:', response.statusText);
        yPos += 10;
      }
    } catch (error) {
      console.error('Error processing logo:', error);
      yPos += 10;
    }
  }

  // Nombre de la empresa (si está disponible)
  if (order.companyName) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(order.companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  }

  // Título según el tipo de orden
  const titles = {
    venta: 'ORDEN DE VENTA',
    compra: 'ORDEN DE COMPRA',
    produccion: 'ORDEN DE PRODUCCIÓN',
  };

  // Encabezado
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(titles[order.tipo], pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Información de la orden
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (order.order_number !== undefined) {
    // Mostrar número secuencial formateado (001, 002, etc.)
    const orderNumberFormatted = String(order.order_number).padStart(3, '0');
    doc.text(`Número de Orden: ${orderNumberFormatted}`, margin, yPos);
    yPos += 7;
  } else if (order.order_id) {
    // Fallback al order_id si no hay order_number (para compatibilidad)
    doc.text(`Número de Orden: ${order.order_id}`, margin, yPos);
    yPos += 7;
  }

  doc.text(`Fecha: ${new Date(order.fecha).toLocaleDateString('es-AR')}`, margin, yPos);
  yPos += 7;

  // Información del cliente (completa si está disponible)
  if (order.clienteData) {
    const client = order.clienteData;
    yPos += 5; // Espacio adicional antes de la sección
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('DATOS DEL CLIENTE:', margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Dividir en dos columnas para mejor uso del espacio
    const leftColumn = margin;
    const rightColumn = pageWidth / 2 + 10;
    let leftY = yPos;
    let rightY = yPos;
    
    if (client.nombre) {
      doc.text(`Nombre: ${client.nombre}`, leftColumn, leftY);
      leftY += 6;
    }
    
    if (client.razon_social) {
      // Razón social puede ser larga, usar ancho completo
      const razonSocialLines = doc.splitTextToSize(`Razón Social: ${client.razon_social}`, pageWidth - 2 * margin);
      doc.text(razonSocialLines, leftColumn, leftY);
      leftY += razonSocialLines.length * 6;
    }
    
    if (client.cuit) {
      doc.text(`CUIT: ${client.cuit}`, leftColumn, leftY);
      leftY += 6;
    }
    
    if (client.direccion) {
      const direccionLines = doc.splitTextToSize(`Dirección: ${client.direccion}`, (pageWidth / 2) - margin - 5);
      doc.text(direccionLines, leftColumn, leftY);
      leftY += direccionLines.length * 6;
    }
    
    if (client.provincia) {
      doc.text(`Provincia: ${client.provincia}`, rightColumn, rightY);
      rightY += 6;
    }
    
    if (client.telefono) {
      doc.text(`Teléfono: ${client.telefono}`, rightColumn, rightY);
      rightY += 6;
    }
    
    if (client.email) {
      const emailLines = doc.splitTextToSize(`Email: ${client.email}`, (pageWidth / 2) - margin - 5);
      doc.text(emailLines, rightColumn, rightY);
      rightY += emailLines.length * 6;
    }
    
    // Usar el mayor de los dos Y para continuar
    yPos = Math.max(leftY, rightY) + 3;
    
    // Observaciones en ancho completo (puede ser largo)
    if (client.observaciones) {
      const observacionesLines = doc.splitTextToSize(`Observaciones: ${client.observaciones}`, pageWidth - 2 * margin);
      doc.text(observacionesLines, margin, yPos);
      yPos += observacionesLines.length * 6 + 3;
    }
    
    yPos += 5; // Espacio adicional después de la sección
  } else if (order.cliente) {
    // Si solo tenemos el nombre del cliente
    yPos += 3;
    doc.text(`Cliente: ${order.cliente}`, margin, yPos);
    yPos += 7;
  }

  if (order.proveedor) {
    doc.text(`Proveedor: ${order.proveedor}`, margin, yPos);
    yPos += 7;
  }

  if (order.nombre) {
    doc.text(`Producto: ${order.nombre}`, margin, yPos);
    yPos += 7;
  }

  if (order.familia) {
    doc.text(`Familia: ${order.familia}`, margin, yPos);
    yPos += 7;
  }

  if (order.medida) {
    doc.text(`Medida: ${order.medida}`, margin, yPos);
    yPos += 7;
  }

  if (order.caracteristica) {
    doc.text(`Característica: ${order.caracteristica}`, margin, yPos);
    yPos += 7;
  }

  yPos += 5;

  // Tabla de items
  const tableData = order.items.map((item) => {
    if (order.tipo === 'venta') {
      // Precio de lista (precio_unitario es el precio base)
      const precioLista = item.precio_lista || item.precio_unitario || 0;
      // Descuento porcentual
      const descuentoPct = item.descuento_pct || 0;
      // Precio unitario final (después de descuentos)
      const precioUnitario = item.precio_unitario || 0;
      
      return [
        item.producto || '-',
        item.cantidad.toString(),
        precioLista > 0 ? `$${precioLista.toFixed(2)}` : '-',
        descuentoPct > 0 ? `${descuentoPct.toFixed(2)}%` : '0%',
        precioUnitario > 0 ? `$${precioUnitario.toFixed(2)}` : '-',
      ];
    } else if (order.tipo === 'compra') {
      const moneda = item.moneda || 'ARS';
      const precio = item.precio || item.precio_unitario || 0;
      const total = item.total || (precio * item.cantidad);
      return [
        item.material || item.producto || '-',
        item.cantidad.toString(),
        moneda === 'USD' && item.valor_dolar 
          ? `$${precio.toFixed(2)} USD ($${(precio * item.valor_dolar).toFixed(2)} ARS)`
          : `$${precio.toFixed(2)}`,
        moneda,
        `$${total.toFixed(2)}`,
      ];
    } else {
      // Producción
      return [
        item.material || '-',
        item.cantidad.toString(),
      ];
    }
  });

  const headers = 
    order.tipo === 'venta'
      ? ['Producto', 'Cantidad', 'Precio de Lista', 'Descuento', 'Precio Unit.']
      : order.tipo === 'compra'
      ? ['Material/Producto', 'Cantidad', 'Precio', 'Moneda', 'Total']
      : ['Material', 'Cantidad (kg)'];

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });

  // Totales
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
  yPos = finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);

  if (order.tipo === 'venta') {
    // Calcular total de la venta (cantidad * precio unitario final)
    const totalVenta = order.items.reduce((sum, item) => {
      const precio = item.precio_unitario || 0;
      return sum + (precio * item.cantidad);
    }, 0);
    doc.text(`Total: $${totalVenta.toFixed(2)}`, margin, yPos);
  } else if (order.tipo === 'compra') {
    if (order.total_compra !== undefined) {
      doc.text(`Total Compra: $${order.total_compra.toFixed(2)}`, margin, yPos);
    }
  } else {
    // Producción
    if (order.cantidad_fabricar !== undefined) {
      doc.text(`Cantidad a Fabricar: ${order.cantidad_fabricar} unidades`, margin, yPos);
    }
  }

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(
    `Generado el ${new Date().toLocaleString('es-AR')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Generar nombre del archivo
  const fileName = `${order.tipo}_${order.order_id || order.fecha.replace(/\//g, '-')}_${Date.now()}.pdf`;
  
  // Guardar PDF
  doc.save(fileName);
}





