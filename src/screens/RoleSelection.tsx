import { useNavigate } from 'react-router-dom';
import '../assets/css/RoleSelection.css'; // optional styling

const RoleSelection = () => {
    const navigate = useNavigate();

    const handleRoleSelect = (role: string) => {
        if (role === 'farmer') {
            navigate('/RSBSAForm/');
        } else {
            navigate(`/login/${role}`);
        }
    };

    return (
        <div className="role-selection-container">
            <h2>Select User Role</h2>
            <div className="role-buttons">
                <button onClick={() => handleRoleSelect('admin')}>Admin Login</button>
                <button onClick={() => handleRoleSelect('technician')}>Technician Login</button>
                <button onClick={() => handleRoleSelect('farmer')}>Farmer Online Registration</button>
            </div>
            <div className="role-buttons" style={{ marginTop: '20px' }}>
                <button onClick={() => navigate('/register/admin')}>Register as Admin</button>
                <button onClick={() => navigate('/register/technician')}>Register as Technician</button>
            </div>
        </div>
    );
};

export default RoleSelection;