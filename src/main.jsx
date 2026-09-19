import React from 'react';
import { createRoot } from 'react-dom/client';
import { Presenter, PresenterOutput } from './Presenter.jsx';
import './base.css';
const view=location.pathname==='/presenter-output'?<PresenterOutput/>:<Presenter/>;
createRoot(document.getElementById('root')).render(view);
