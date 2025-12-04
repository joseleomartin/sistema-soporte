import { useState } from 'react';
import { Table2, FileText, Scale, Calendar, ArrowLeft } from 'lucide-react';
import { TableExtractor } from './TableExtractor';
import { PDFtoOCR } from './PDFtoOCR';
import { Consilador } from './Consilador';
import { Vencimientos } from './Vencimientos';

const tools = [
  {
    id: 'table-extractor',
    name: 'Extractor de Tablas',
    description: 'Extrae tablas de documentos y archivos',
    icon: Table2,
    color: 'bg-blue-100 text-blue-600',
    hoverColor: 'hover:bg-blue-50',
    comingSoon: false,
  },
  {
    id: 'pdf-ocr',
    name: 'PDF a OCR',
    description: 'Convierte PDFs escaneados a texto editable',
    icon: FileText,
    color: 'bg-green-100 text-green-600',
    hoverColor: 'hover:bg-green-50',
    comingSoon: false,
  },
  {
    id: 'consilador',
    name: 'Consiliador',
    description: 'Concilia y compara datos financieros',
    icon: Scale,
    color: 'bg-purple-100 text-purple-600',
    hoverColor: 'hover:bg-purple-50',
    comingSoon: false,
  },
  {
    id: 'vencimiento',
    name: 'Vencimiento',
    description: 'Gestiona y controla vencimientos de clientes',
    icon: Calendar,
    color: 'bg-orange-100 text-orange-600',
    hoverColor: 'hover:bg-orange-50',
    comingSoon: false,
  },
];

export function ToolsPanel() {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const handleToolClick = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (tool?.comingSoon) {
      return; // No hacer nada si está en "próximamente"
    }
    setActiveTool(toolId);
  };

  const handleBack = () => {
    setActiveTool(null);
  };

  // Si hay una herramienta activa, mostrarla
  if (activeTool === 'table-extractor') {
    return (
      <div className="h-full overflow-auto">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Herramientas
        </button>
        <TableExtractor />
      </div>
    );
  }

  if (activeTool === 'pdf-ocr') {
    return (
      <div className="h-full overflow-auto">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Herramientas
        </button>
        <PDFtoOCR />
      </div>
    );
  }

  if (activeTool === 'consilador') {
    return (
      <div className="h-full overflow-auto">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Herramientas
        </button>
        <Consilador />
      </div>
    );
  }

  if (activeTool === 'vencimiento') {
    return (
      <div className="h-full overflow-auto">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Herramientas
        </button>
        <Vencimientos />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Herramientas</h1>
        <p className="text-gray-600">Utilidades y herramientas útiles para tu trabajo diario</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isExperimental = tool.id === 'consilador';
          const isComingSoon = tool.comingSoon;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left transition relative ${
                isComingSoon 
                  ? 'opacity-75 cursor-not-allowed' 
                  : `${tool.hoverColor} hover:shadow-md group`
              }`}
            >
              {isExperimental && (
                <span className="absolute top-3 right-3 bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full border border-yellow-300">
                  Experimental
                </span>
              )}
              {isComingSoon && (
                <span className="absolute top-3 right-3 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full border border-blue-300">
                  Próximamente
                </span>
              )}
              <div className={`w-14 h-14 ${tool.color} rounded-xl flex items-center justify-center mb-4 ${!isComingSoon ? 'group-hover:scale-110 transition' : ''}`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
              <p className="text-sm text-gray-600">{tool.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Próximamente</h3>
        <p className="text-sm text-blue-700">
          Estamos trabajando en agregar más herramientas útiles. Si tienes alguna sugerencia,
          por favor contacta con el equipo de soporte.
        </p>
      </div>
    </div>
  );
}
