import FarmlandMap from './components/FarmlandMap';
import '../assets/css/App.css';

function App() {
    return (
        <div className="App">
            <header className="App-header">
                <h1>Farmland Choropleth Map</h1>
            </header>
            <main>
                <FarmlandMap />
            </main>
        </div>
    );
}

export default App; 