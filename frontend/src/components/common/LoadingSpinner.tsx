export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]" role="status" aria-label="Carregando">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#08133E] border-t-[#50A6D2]" />
    </div>
  );
}
