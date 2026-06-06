import { create } from 'zustand';
import type { BoardData, Stage, WorkOrderCard } from '@/types';

interface BoardStore {
  board: BoardData | null;
  sseStatus: 'connecting' | 'connected' | 'error' | 'closed';
  setBoard: (data: BoardData) => void;
  setSseStatus: (status: 'connecting' | 'connected' | 'error' | 'closed') => void;
  moveCard: (id: string, from: Stage, to: Stage, updated: WorkOrderCard) => void;
  revertMove: (id: string, from: Stage, to: Stage, original: WorkOrderCard) => void;
  addCard: (card: WorkOrderCard) => void;
  updateCard: (card: WorkOrderCard) => void;
  removeCard: (id: string) => void;
}

const stageKey = (s: Stage): keyof BoardData => s.toLowerCase() as keyof BoardData;
const removeEverywhere = (board: BoardData, id: string) => {
  (Object.keys(board) as (keyof BoardData)[]).forEach((key) => {
    board[key] = board[key].filter((c) => c.id !== id);
  });
};

export const useBoardStore = create<BoardStore>((set) => ({
  board: null,
  sseStatus: 'closed',
  setBoard: (data) => set({ board: data }),
  setSseStatus: (status) => set({ sseStatus: status }),
  moveCard: (id, from, to, updated) => set((state) => {
    if (!state.board) return state;
    const board = { ...state.board };
    board[stageKey(from)] = board[stageKey(from)].filter((c) => c.id !== id);
    board[stageKey(to)] = [...board[stageKey(to)].filter((c) => c.id !== id), updated];
    return { board };
  }),
  revertMove: (id, from, to, original) => set((state) => {
    if (!state.board) return state;
    const board = { ...state.board };
    board[stageKey(to)] = board[stageKey(to)].filter((c) => c.id !== id);
    board[stageKey(from)] = [...board[stageKey(from)], original];
    return { board };
  }),
  addCard: (card) => set((state) => {
    if (!state.board) return state;
    const board = { ...state.board };
    removeEverywhere(board, card.id);
    board[stageKey(card.stage)] = [...board[stageKey(card.stage)], card];
    return { board };
  }),
  updateCard: (card) => set((state) => {
    if (!state.board) return state;
    const board = { ...state.board };
    removeEverywhere(board, card.id);
    board[stageKey(card.stage)] = [...board[stageKey(card.stage)], card];
    return { board };
  }),
  removeCard: (id) => set((state) => {
    if (!state.board) return state;
    const board = { ...state.board };
    removeEverywhere(board, id);
    return { board };
  }),
}));
