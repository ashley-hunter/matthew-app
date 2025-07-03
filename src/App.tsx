import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BrakePressCalculator from './pages/BrakePressCalculator';

// Root component for the Brake Press Costing Calculator application
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main route rendering the AppPage component */}
        <Route path="/" element={<BrakePressCalculator />} />
        {/* Add more routes here as you add more pages */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

