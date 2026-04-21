"use client";

import { useState, useEffect } from "react";

interface Paragraph {
  id: string;
  title: string;
  text: string;
}

interface Result {
  paragraphId: string;
  accuracy: number;
  timestamp: number;
}

// Types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

export default function Home() {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedParagraphs = localStorage.getItem("memory-paragraphs");
    const savedResults = localStorage.getItem("memory-results");
    
    Promise.resolve().then(() => {
      if (savedParagraphs) {
        const parsed = JSON.parse(savedParagraphs);
        // Migration logic: convert string[] to Paragraph[]
        if (parsed.length > 0 && typeof parsed[0] === "string") {
          const migrated: Paragraph[] = (parsed as string[]).map((text, i) => ({
            id: `legacy-${Date.now()}-${i}`,
            title: "",
            text: text,
          }));
          setParagraphs(migrated);
        } else {
          setParagraphs(parsed);
        }
      }
      if (savedResults) {
        setResults(JSON.parse(savedResults));
      }
      setIsLoaded(true);
    });
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("memory-paragraphs", JSON.stringify(paragraphs));
    }
  }, [paragraphs, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("memory-results", JSON.stringify(results));
    }
  }, [results, isLoaded]);

  const [inputTitle, setInputTitle] = useState("");
  const [inputText, setInputText] = useState("");
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [typingInput, setTypingInput] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Helper for flexible matching
  const normalizeWord = (word: string) => {
    return word.toLowerCase().replace(/[.,?!;:'"()\[\]{}-]/g, "");
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setTypingInput(prev => prev + (prev.length > 0 ? " " : "") + finalTranscript);
      }
    };

    recognition.start();
  };

  const handleSaveParagraph = () => {
    if (!inputText.trim()) return;
    
    if (editingParagraphId) {
      setParagraphs(paragraphs.map(p => 
        p.id === editingParagraphId 
          ? { ...p, title: inputTitle.trim(), text: inputText.trim() } 
          : p
      ));
      setEditingParagraphId(null);
    } else {
      const newParagraph: Paragraph = {
        id: `p-${Date.now()}`,
        title: inputTitle.trim(),
        text: inputText.trim(),
      };
      setParagraphs([...paragraphs, newParagraph]);
    }
    
    setInputTitle("");
    setInputText("");
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete your entire collection? This cannot be undone.")) {
      setParagraphs([]);
      setResults([]);
      setActiveParagraphIndex(null);
      setEditingParagraphId(null);
      setInputTitle("");
      setInputText("");
    }
  };

  const startEditing = (index: number) => {
    const p = paragraphs[index];
    setEditingParagraphId(p.id);
    setInputTitle(p.title);
    setInputText(p.text);
  };

  const cancelEditing = () => {
    setEditingParagraphId(null);
    setInputTitle("");
    setInputText("");
  };

  const handleDeleteParagraph = (index: number) => {
    if (activeParagraphIndex === index) setActiveParagraphIndex(null);
    else if (activeParagraphIndex !== null && activeParagraphIndex > index) {
      setActiveParagraphIndex(activeParagraphIndex - 1);
    }
    const updated = paragraphs.filter((_, i) => i !== index);
    setParagraphs(updated);
    if (editingParagraphId === paragraphs[index].id) {
      cancelEditing();
    }
  };

  const startPractice = (index: number) => {
    setActiveParagraphIndex(index);
    setTypingInput("");
    setAccuracy(null);
    setIsFlipped(false);
    setIsFinished(false);
  };

  const calculateAccuracy = () => {
    if (activeParagraphIndex === null) return;
    const activeParagraph = paragraphs[activeParagraphIndex];
    const targetWords = activeParagraph.text.split(/\s+/).filter(w => w.length > 0);
    const typedWords = typingInput.trim().split(/\s+/).filter(w => w.length > 0);

    let correctCount = 0;
    targetWords.forEach((word, i) => {
      const normalizedTarget = normalizeWord(word);
      const normalizedTyped = normalizeWord(typedWords[i] || "");
      if (normalizedTyped === normalizedTarget) {
        correctCount++;
      }
    });

    const acc = Math.round((correctCount / targetWords.length) * 100);
    setAccuracy(acc);
    
    const newResult: Result = {
      paragraphId: activeParagraph.id,
      accuracy: acc,
      timestamp: Date.now(),
    };
    setResults([...results, newResult]);
    setIsFinished(true);
    setIsListening(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* Sidebar: Paragraph Management */}
      <aside className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 ${activeParagraphIndex !== null ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black mb-1">MemorizeMe</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Manage Texts</p>
          </div>
          {paragraphs.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="text-[10px] text-zinc-400 hover:text-red-500 font-bold uppercase transition-colors"
              title="Delete all texts"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Add/Edit Section */}
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest px-1">
                {editingParagraphId ? "Edit Item" : "Add New Item"}
              </h2>
              {editingParagraphId && (
                <button onClick={cancelEditing} className="text-[10px] text-blue-600 font-bold uppercase">Cancel</button>
              )}
            </div>
            <input
              type="text"
              className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Title (optional)"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
            />
            <textarea
              className="w-full h-24 p-2 text-sm border rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              placeholder="Text content..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button
              onClick={handleSaveParagraph}
              className={`w-full py-2 text-white text-xs font-bold rounded-lg transition-colors ${editingParagraphId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {editingParagraphId ? "Update Item" : "Add to Collection"}
            </button>
          </div>

          {/* List Section */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest px-2">Your Collection</h2>
            {paragraphs.length === 0 ? (
              <p className="text-xs text-zinc-500 italic px-2">Empty...</p>
            ) : (
              paragraphs.map((p, i) => (
                <div
                  key={p.id}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                    activeParagraphIndex === i
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                      : "bg-zinc-50 border-zinc-100 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700"
                  }`}
                  onClick={() => startPractice(i)}
                >
                  <div className="flex flex-col gap-1 pr-14">
                    {p.title && (
                      <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
                        {p.title}
                      </h4>
                    )}
                    <p className={`text-[11px] line-clamp-2 leading-relaxed ${p.title ? 'text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {p.text}
                    </p>
                  </div>
                  <div className="absolute top-2 right-2 md:opacity-0 group-hover:opacity-100 transition-all flex gap-1 bg-white/80 dark:bg-zinc-900/80 rounded-md p-1 shadow-sm backdrop-blur-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(i);
                      }}
                      className="p-1 hover:text-blue-600"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteParagraph(i);
                      }}
                      className="p-1 hover:text-red-600"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mini Performance History */}
        {results.length > 0 && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Recent Sessions</h3>
            <div className="space-y-1">
              {results.slice(-3).reverse().map((r, i) => {
                const p = paragraphs.find(para => para.id === r.paragraphId);
                return (
                  <div key={i} className="text-[10px] flex justify-between">
                    <span className="truncate max-w-[120px]">{p?.title || "Untitled"}</span>
                    <span className="font-bold text-blue-600">{r.accuracy}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* Main Workspace */}
      <main className={`flex-1 flex flex-col overflow-hidden bg-white dark:bg-black ${activeParagraphIndex === null ? 'hidden md:flex' : 'flex'}`}>
        {activeParagraphIndex === null ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-12">
            <div className="text-6xl mb-6 opacity-20">📚</div>
            <h2 className="text-2xl font-bold mb-2">Ready to start?</h2>
            <p className="text-zinc-500 max-w-sm">Select a practice item from the left sidebar or create a new one to begin your training.</p>
          </div>
        ) : isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 animate-in fade-in zoom-in duration-300">
            <div className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 p-8 md:p-12 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-center shadow-2xl">
              {paragraphs[activeParagraphIndex].title && (
                <div className="text-xs font-black uppercase text-blue-600 tracking-widest mb-2">
                  {paragraphs[activeParagraphIndex].title}
                </div>
              )}
              <h2 className="text-3xl md:text-4xl font-black mb-6 md:mb-8">Results</h2>
              <div className="mb-6 md:mb-8">
                <div className="text-5xl md:text-7xl font-black text-blue-600 mb-2">{accuracy}%</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Accuracy Score</div>
              </div>
              <p className="text-zinc-500 mb-6 md:mb-8 leading-relaxed text-sm md:text-base">
                {accuracy === 100 ? "Incredible! Your memory is perfect." : "A solid effort! Consistency is the key to improvement."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => startPractice(activeParagraphIndex)}
                  className="flex-1 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold hover:scale-[1.02] transition-transform"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setActiveParagraphIndex(null)}
                  className="flex-1 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 space-y-6 md:space-y-8 overflow-y-auto">
            <div className="flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveParagraphIndex(null)}
                  className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div>
                  <h2 className="text-xl md:text-2xl font-black truncate max-w-[180px] sm:max-w-xs">
                    {paragraphs[activeParagraphIndex].title || "Active Session"}
                  </h2>
                  <p className="text-[10px] md:text-sm text-zinc-500 uppercase font-bold tracking-wider">Practice Session</p>
                </div>
              </div>
              <button
                onClick={() => setActiveParagraphIndex(null)}
                className="text-xs md:text-sm font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                End <span className="hidden sm:inline">Session</span>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 min-h-[300px] md:min-h-[450px]">
              {/* Left Side: Flippable Card */}
              <div className="relative perspective-1000 min-h-[280px] md:min-h-[400px]">
                <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>
                  {/* Front Side: Hidden */}
                  <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-6 md:p-8 backface-hidden shadow-inner">
                    <div className="text-4xl md:text-5xl mb-4 md:mb-6">👁️‍🗨️</div>
                    <h3 className="text-lg md:text-xl font-black mb-2 md:mb-3">Text Hidden</h3>
                    <p className="text-zinc-500 text-center text-xs md:text-sm mb-6 md:mb-8 max-w-[200px] md:max-w-[240px]">Test your memory! Flip the card if you need to check the reference.</p>
                    <button
                      onClick={() => setIsFlipped(true)}
                      className="px-6 md:px-8 py-2 md:py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95 text-sm"
                    >
                      Peek at Text
                    </button>
                  </div>

                  {/* Back Side: Visible Text */}
                  <div className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-blue-500/30 p-6 md:p-10 rotate-y-180 backface-hidden overflow-auto shadow-xl">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                      <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.3em]">Reference View</span>
                      <button
                        onClick={() => setIsFlipped(false)}
                        className="text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        Hide
                      </button>
                    </div>
                    <div className="font-serif leading-[1.8] text-lg md:text-xl">
                      {paragraphs[activeParagraphIndex].text.split(/\s+/).map((word, i) => {
                        const typedWords = typingInput.trim().split(/\s+/);
                        let color = "text-zinc-400";
                        if (i < typedWords.length && typedWords[0] !== "") {
                          const normalizedTarget = normalizeWord(word);
                          const normalizedTyped = normalizeWord(typedWords[i] || "");
                          color = normalizedTyped === normalizedTarget ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
                        } else if (i === typedWords.length || (i === 0 && typingInput === "")) {
                          color = "text-blue-600 dark:text-blue-400 font-bold underline decoration-2 underline-offset-4";
                        }
                        return (
                          <span key={i} className={`${color} mr-2 transition-colors`}>
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Input Area */}
              <div className="flex flex-col space-y-4 md:space-y-6 min-h-[300px]">
                <div className="flex-1 relative">
                  <textarea
                    autoFocus
                    className="w-full h-full p-6 md:p-8 text-lg md:text-xl border-2 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800 focus:border-blue-500/50 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all font-mono resize-none shadow-inner"
                    placeholder="Type or click the microphone to speak..."
                    value={typingInput}
                    onChange={(e) => setTypingInput(e.target.value)}
                  />
                  <button
                    onClick={toggleListening}
                    className={`absolute bottom-4 right-4 p-4 rounded-full transition-all shadow-lg ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:text-blue-600 border border-zinc-200 dark:border-zinc-700'
                    }`}
                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                  >
                    {isListening ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    )}
                  </button>
                </div>
                <button
                  onClick={calculateAccuracy}
                  className="w-full py-4 md:py-5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-3xl hover:scale-[1.01] active:scale-[0.99] transition-all font-black text-lg shadow-xl"
                >
                  Evaluate Session
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
