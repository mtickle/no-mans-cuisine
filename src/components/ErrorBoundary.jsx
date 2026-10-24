import React from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("System Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-4">
          <div className="bg-slate-900 border border-red-900/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            <div className="inline-flex items-center justify-center p-3 bg-red-950/50 rounded-full mb-6 border border-red-900/50">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black mb-2 text-white">System Malfunction</h1>
            <p className="text-slate-400 mb-8 text-sm">
              {this.state.error?.message || "An unexpected error occurred in the component tree."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="py-2 px-6 bg-white text-slate-950 font-bold rounded-lg transition-all hover:bg-slate-200"
            >
              Reboot System
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
