import {useSyncExternalStore} from 'react';
import {subscribeCopyText,getCopyTextMode} from '@/lib/copyTextPreference.mjs';
export default function useCopyTextPreference(){return useSyncExternalStore(subscribeCopyText,getCopyTextMode,()=> 'auto');}
