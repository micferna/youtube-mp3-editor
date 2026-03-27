import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DownloadPage from './pages/DownloadPage'
import EditorPage from './pages/EditorPage'
import LibraryPage from './pages/LibraryPage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DownloadPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
