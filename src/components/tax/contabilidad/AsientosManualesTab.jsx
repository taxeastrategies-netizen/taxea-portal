import LibroDiario from './LibroDiario';

export default function AsientosManualesTab({ companyId, user }) {
  return <LibroDiario companyId={companyId} user={user} initialSource="manual" />;
}

