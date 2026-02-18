
import React from 'react';
import Dashboard from './Dashboard';

// This component is now a wrapper for Dashboard to maintain consistency during rebranding
const Home: React.FC<any> = (props) => {
  return <Dashboard {...props} />;
};

export default Home;
