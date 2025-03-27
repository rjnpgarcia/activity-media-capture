const SideNav = ({ title, link1, route1, link2, route2, link3, route3 }) => {
    return (
        <div
            className="bg-dark text-white p-3 position-fixed"
            style={{
                width: "250px",
                height: "100vh",
                top: "0",
                left: "0",
                overflowY: "auto",
                boxShadow: "2px 0 5px rgba(0, 0, 0, 0.2)"
            }}
        >
            <h4 className="mb-4">{title}</h4>
            <ul className="nav flex-column">
                {[
                    { link: link1, route: route1 },
                    { link: link2, route: route2 },
                    { link: link3, route: route3 }
                ].map(({ link, route }, index) => (
                    <li className="nav-item" key={index}>
                        <a
                            className="nav-link text-white py-2 px-3"
                            href={route}
                            style={{
                                transition:
                                    "background 0.3s ease, color 0.3s ease",
                                borderRadius: "5px"
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = "#555";
                                e.target.style.color = "#fff";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = "transparent";
                                e.target.style.color = "#fff";
                            }}
                        >
                            {link}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SideNav;
