import "../assets/css/LandPage.css";

const LandsPage = () => {
    return (
        <div className="lands-container">
            <h2>Land Records</h2>
            <div className="lands-table-wrapper">
                <table className="lands-table">
                    <thead>
                        <tr>
                            <th>FIRST NAME</th>
                            <th>MIDDLE NAME</th>
                            <th>EXT NAME</th>
                            <th>GENDER</th>
                            <th>BIRTHDATE</th>
                            <th colSpan={3}>FARMER ADDRESS</th>
                            <th>PARCEL NO.</th>
                            <th>PARCEL ADDRESS</th>
                            <th>PARCEL AREA</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Juan</td>
                            <td>Dela</td>
                            <td>Cruz</td>
                            <td>Male</td>
                            <td>01/01/1980</td>
                            <td>Brgy. 1</td>
                            <td>City</td>
                            <td>Province</td>
                            <td>12345</td>
                            <td>Brgy. 2, City</td>
                            <td>1.5 ha</td>
                        </tr>
                        <tr>
                            <td>Maria</td>
                            <td>Santos</td>
                            <td></td>
                            <td>Female</td>
                            <td>05/12/1975</td>
                            <td>Brgy. 3</td>
                            <td>Town</td>
                            <td>Province</td>
                            <td>67890</td>
                            <td>Brgy. 4, Town</td>
                            <td>2.0 ha</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LandsPage;
