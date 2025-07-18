<div className="min-h-screen bg-slate-900 p-6">
  <header className="text-center mb-12">
    <h1 className="text-5xl font-bold text-white mb-4">
      Project Timeline Accordion
    </h1>
    <p className="text-lg text-gray-400">
      Powered by MMM's Project Management
    </p>
  </header>

  <div className="max-w-6xl mx-auto space-y-8">
    <ProjectCard onAddAsset={addAsset} />
    
    {assets.length > 0 && (
      <ConfigureAssets 
        assets={assets}
        onRemoveAsset={removeAsset}
        onUpdateAssetDate={updateAssetDate}
      />
    )}
  </div>
</div>
