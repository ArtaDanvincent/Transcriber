"use client";

import { useState } from "react";
import { Speaker } from "@/types";

const DEFAULT_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

interface SpeakerPanelProps {
  speakers: Speaker[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: string, updates: Partial<Speaker>) => void;
  onDelete: (id: string) => void;
}

export function SpeakerPanel({ speakers, onAdd, onUpdate, onDelete }: SpeakerPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    const color = DEFAULT_COLORS[speakers.length % DEFAULT_COLORS.length];
    onAdd(newName.trim(), color);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Speakers</h3>
      {speakers.map((speaker) => (
        <div key={speaker.id} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: speaker.color }}
          />
          <input
            value={speaker.name}
            onChange={(e) => onUpdate(speaker.id, { name: e.target.value })}
            className="text-sm text-gray-700 bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 flex-1"
          />
          <button
            onClick={() => onDelete(speaker.id)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            &times;
          </button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Speaker name"
            autoFocus
            className="text-sm border border-gray-300 rounded px-2 py-1 flex-1 outline-none focus:border-blue-500"
          />
          <button onClick={handleAdd} className="text-xs text-blue-600">
            Add
          </button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-400">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add Speaker
        </button>
      )}
    </div>
  );
}
