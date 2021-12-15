"use strict";

var _ = require('lodash');

var Layer = function (geoServerLayer) {

  if (geoServerLayer.hasOwnProperty('Name'))
    this.name = geoServerLayer.Name;
  else if (geoServerLayer.hasOwnProperty('wfs:Name'))
    this.name = geoServerLayer['wfs:Name'];

  if (geoServerLayer.hasOwnProperty('Title'))
    this.title = geoServerLayer.Title;
  else if (geoServerLayer.hasOwnProperty('wfs:Title'))
    this.title = geoServerLayer['wfs:Title'];

  if (geoServerLayer.hasOwnProperty('Abstract')) this.abstract = geoServerLayer.Abstract;
  if (geoServerLayer.hasOwnProperty('CRS')) this.CRS = geoServerLayer.CRS;
  if (geoServerLayer.hasOwnProperty('id')) this.id = geoServerLayer.id;
  if (geoServerLayer.hasOwnProperty('format')) this.format = geoServerLayer.format;
  if (geoServerLayer.hasOwnProperty('$')) {
    if (geoServerLayer.$.hasOwnProperty('queryable')) this.queryable = setTrueOrFalse(geoServerLayer.$.queryable);
  }
}

function setTrueOrFalse (value) {
  if (value === 0 || value === "0") return false;
  else return true;
}

var Attribute = function (geoServerAttribute) {
  
  if (geoServerAttribute['xsd:schema']) {
    var path = 'xsd:schema.xsd:complexType.xsd:complexContent.xsd:extension.xsd:sequence.xsd:element';
  } else if (geoServerAttribute['xs:schema']) {
    var path = 'xs:schema.xs:complexType.xs:complexContent.xs:extension.xs:sequence.xs:element';
  }  

  if (_.has(geoServerAttribute, path)) {
    var elements = _.get(geoServerAttribute, path);
    var attArray = [];
    for (let element of elements) {
      attArray.push(element.$);
    }
    return attArray;

    // console.log(counter++);
  } else if (_.has(geoServerAttribute, 'ows:ExceptionReport')) {
    if (_.has(geoServerAttribute, 'ows:ExceptionReport.ows:Exception.ows:ExceptionText')) {
      var ExceptionText = _.get(geoServerAttribute, 'ows:ExceptionReport.ows:Exception.ows:ExceptionText');
      return {
        exceptionMessage: ExceptionText
      }
    }
    return {
      exceptionMessage: 'no attributes was available for this layer, or server has another format than (request=DescribeFeatureType&typename=layerName)'
    }
  } else {
    return {
      exceptionMessage: 'provided path to the elements did not exist. (propably map server is using another version)'
    }
  }
}

module.exports.Layer = Layer;
module.exports.Attribute = Attribute;

/*
format of response from geoserver is like this before it is converted to JSON:

<xsd:schema xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:sok="http://botkyrka.se/sok" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified" targetNamespace="http://botkyrka.se/sok">
<xsd:import namespace="http://www.opengis.net/gml/3.2" schemaLocation="http://decerno-geo01.redbridge.se:80/geoserver/schemas/gml/3.2.1/gml.xsd"/>
  <xsd:complexType name="adress_sokType">
    <xsd:complexContent>
      <xsd:extension base="gml:AbstractFeatureType">
        <xsd:sequence>
          <xsd:element maxOccurs="1" minOccurs="0" name="adress" nillable="true" type="xsd:string"/>
          <xsd:element maxOccurs="1" minOccurs="0" name="the_geom" nillable="true" type="gml:PointPropertyType"/>
        </xsd:sequence>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
<xsd:element name="adress_sok" substitutionGroup="gml:AbstractFeature" type="sok:adress_sokType"/>
</xsd:schema>
*/



/*
format of exception:

<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows" version="1.1.0" language="en">
  <ows:Exception exceptionCode="NoApplicableCode">
    <ows:ExceptionText>Unknown operation name.</ows:ExceptionText>
  </ows:Exception>
</ows:ExceptionReport>
*/