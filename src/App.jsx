import { useEffect, useState } from "react";
import { Auth } from "./Auth";
import TaskManager from "./TaskManager";
import supabase from "./SupaBaseClient";
import { Toaster } from "@/components/ui/toaster";

function App() {
  const [session, setSession] = useState(null);

  const fetchSession = async () => {
    const currentSession = await supabase.auth.getSession();
    console.log(currentSession);
    setSession(currentSession.data.session);
  };

  useEffect(() => {
    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {session ? (
        <div className="container mx-auto p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 sm:flex-none">
                <h2 className="font-bold text-gray-800 text-lg truncate">
                  {session.user.email?.split('@')[0]}
                </h2>
                <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span className="truncate">{session.user.email}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              Log Out
            </button>
          </div>
          <TaskManager session={session} />
        </div>
      ) : (
        <Auth />
      )}
      <Toaster />
    </div>
  );
}

export default App;