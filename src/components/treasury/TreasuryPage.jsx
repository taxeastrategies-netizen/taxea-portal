import { useOutletContext } from 'react-router-dom';
import TreasuryCenter from './TreasuryCenter';

export default function TreasuryPage() {
  const ctx = useOutletContext?.() || {};
  const company = ctx?.company || null;
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <TreasuryCenter company={company} />
    </div>
  );
}