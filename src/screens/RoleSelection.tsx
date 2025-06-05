import { useNavigate } from 'react-router-dom';
import '../assets/css/RoleSelection.css'; // optional styling

const RoleSelection = () => {
    const navigate = useNavigate();

    const handleRoleSelect = (role: string) => {
        if (role === 'farmer') {
            navigate ('/RSBSAForm/');
        } else {
        navigate(`/login/${role}`);
        }
    };

    return (
        <div className="role-selection-container">
            <h2>Select User Role</h2>
            <div className="role-buttons">
                <button onClick={() => handleRoleSelect('admin')}>Admin</button>
                <button onClick={() => handleRoleSelect('technician')}>Technician</button>
                <button onClick={() => handleRoleSelect('farmer')}>Farmer Online Registration</button>
            </div>
        </div>
    );
};

export default RoleSelection;