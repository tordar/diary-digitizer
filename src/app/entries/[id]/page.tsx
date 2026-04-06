export default function EntryPage({ params }: { params: { id: string } }) {
  return <div className="p-8 text-slate-400">Oppføring {params.id}</div>
}
