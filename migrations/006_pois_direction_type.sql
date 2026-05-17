-- Migration 006 : ajout du type 'direction' dans les POIs (roadbook/carnet de route)
ALTER TABLE pois
  MODIFY COLUMN type ENUM(
    'signaleur','ravito','danger','secteur','depart','arrivee','direction'
  ) NOT NULL;
