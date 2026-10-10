import { useEffect, useSyncExternalStore } from "react";

import api from "../services/api";
import useAuth from "./useAuth";

const STALE_AFTER_MS = 60_000;

let state = {
  status: "idle", 
  ids: new Set(), 
  loadedAt: 0,
};

let inflight = null;
let generation = 0;

const listeners = new Set();

function emit(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function loadWishlist() {
  if (inflight) return inflight;

  const isFresh =
    state.status !== "idle" && Date.now() - state.loadedAt < STALE_AFTER_MS;

  if (isFresh) return null;

  const startedIn = generation;

  inflight = api
    .get("/wishlist/")
    .then((response) => {
      if (startedIn !== generation) return;

      emit({
        status: "ready",
        ids: new Set((response.data?.items || []).map((item) => String(item.product_id))),
        loadedAt: Date.now(),
      });
    })
    .catch(() => {
      if (startedIn !== generation) return;

      emit({ ...state, status: "error", loadedAt: Date.now() });
    })
    .finally(() => {
      if (startedIn === generation) inflight = null;
    });

  return inflight;
}

export function resetWishlist() {
  generation += 1;
  inflight = null;

  emit({ status: "idle", ids: new Set(), loadedAt: 0 });
}

export function setWishlistSaved(productId, saved) {
  const ids = new Set(state.ids);

  if (saved) {
    ids.add(String(productId));
  } else {
    ids.delete(String(productId));
  }

  emit({ ...state, ids });
}

export default function useWishlist() {
  const { isAuthenticated } = useAuth();

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (isAuthenticated) {
      loadWishlist();
    } else if (state.status !== "idle") {
      resetWishlist();
    }
  }, [isAuthenticated]);

  return {
    isAuthenticated,
    isSaved: (productId) => snapshot.ids.has(String(productId)),
  };
}