import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Search from './pages/Search'
import Results from './pages/Results'

function App() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[600px] px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
