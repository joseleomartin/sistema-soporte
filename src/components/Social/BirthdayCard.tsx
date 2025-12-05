import { useState } from 'react';
import { Cake, Sparkles, MessageCircle } from 'lucide-react';
import { BirthdayComments } from './BirthdayComments';

interface BirthdayUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  birthday: string;
}

interface BirthdayCardProps {
  users: BirthdayUser[];
}

export function BirthdayCard({ users }: BirthdayCardProps) {
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});

  const toggleComments = (userId: string) => {
    setShowComments((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const formatBirthday = (birthday: string): string => {
    // Parsear la fecha directamente del string para evitar problemas de zona horaria
    let birthdayStr = birthday;
    if (birthdayStr.includes('T')) {
      birthdayStr = birthdayStr.split('T')[0];
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthdayStr)) {
      const [, month, day] = birthdayStr.split('-');
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const monthIndex = parseInt(month, 10) - 1;
      return `${parseInt(day, 10)} de ${monthNames[monthIndex]}`;
    }
    
    // Fallback
    const date = new Date(birthdayStr + 'T12:00:00');
    return date.toLocaleDateString('es-ES', {
      month: 'long',
      day: 'numeric',
    });
  };

  const getAge = (birthday: string): number => {
    // Parsear la fecha directamente del string para evitar problemas de zona horaria
    let birthdayStr = birthday;
    if (birthdayStr.includes('T')) {
      birthdayStr = birthdayStr.split('T')[0];
    }
    
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthdayStr)) {
      const [year, month, day] = birthdayStr.split('-').map(Number);
      let age = todayYear - year;
      
      // Ajustar edad si aún no ha cumplido años este año
      if (todayMonth < month || (todayMonth === month && todayDay < day)) {
        age--;
      }
      return age;
    }
    
    // Fallback
    const birthDate = new Date(birthdayStr + 'T12:00:00');
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (users.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-xl shadow-lg border-2 border-white overflow-hidden mb-6">
      <div className="p-6 text-white relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white bg-opacity-20 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-white bg-opacity-20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
              <Cake className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">¡Feliz Cumpleaños! 🎉</h3>
              <p className="text-white text-opacity-90 text-sm">
                {users.length === 1 
                  ? `Hoy es un día especial para ${users[0].full_name}`
                  : `Hoy es un día especial para ${users.length} personas`}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id}>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white bg-opacity-30 flex items-center justify-center border-2 border-white">
                        <span className="text-2xl font-bold text-white">
                          {user.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg text-white">
                      {user.full_name}
                    </p>
                    <p className="text-white text-opacity-90 text-sm">
                      {formatBirthday(user.birthday)} • {getAge(user.birthday)} años
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                  </div>
                </div>

                {/* Comentarios */}
                <div className="mt-3 ml-4">
                  <button
                    onClick={() => toggleComments(user.id)}
                    className="flex items-center gap-2 text-white text-opacity-90 hover:text-opacity-100 transition-colors text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Comentarios</span>
                  </button>
                  {showComments[user.id] && (
                    <div className="mt-3">
                      <BirthdayComments birthdayUserId={user.id} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

