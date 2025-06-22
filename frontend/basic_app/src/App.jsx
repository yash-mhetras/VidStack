import './App.css'
import {BrowserRouter as Router,Routes,Route} from "react-router-dom"
import Landingpage from './pages/landingpage.jsx'
import Authentication from './pages/authentication.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx';

import VideoMeet from './pages/VideoMeet.jsx';
import HomeComponent from './pages/home.jsx';
import History from "./pages/history.jsx";

function App() {
  

  return (
    <>
      <Router>
        <AuthProvider>
        <Routes>
          <Route path='/' element={<Landingpage/>}/>
          <Route path='/auth' element={<Authentication/>} />
           <Route path='/home' element={<HomeComponent/>} />
          <Route path='/:url' element={<VideoMeet/>}/>
          <Route path='/history' element={<History/>}/>
         
        </Routes>
        </AuthProvider>

      </Router>
    </>
  )
}

export default App
