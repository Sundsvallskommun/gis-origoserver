// args.apiDoc needs to be a js object.  This file could be a json file, but we can't add
// comments in json files.
module.exports = {
  swagger: '2.0',

  // all routes will now have /api/v1 prefixed.
  basePath: '/origoserver/api/v1',

  info: {
    title: 'API GIS',
    version: '1.0',
  },

  definitions: {
    NykoStat: {
      type: 'object',
      properties: {
        men: {
          description: 'The count of men in Nyko.',
          type: 'integer'
        },
        women: {
          description: 'The count of women in Nyko.',
          type: 'integer'
        },
        ageByInterval: {
          description: 'The ages of population sorted in intervals.',
          type: 'array'
        },
        outtakeDate: {
          description: 'The date of outtake of data.',
          type: 'string'
        },
        variables: {
          description: 'Variables with metrics for Nyko.',
          type: 'object',
          additionalProperties: {
              type: "array",
              items: {
                "$ref": "#/definitions/Values"
              }
          }
        }
      },
      required: ['name']
    },
    metadata: {
      type: 'object',
      additionalProperties: {
          type: "string",
          description: "Map with name-value pairs",
          readOnly: true,
          example: "type: DISTRICT_HEATING"
      },
      description: "Map with name-value pairs",
      readOnly: true,
      example: "type: DISTRICT_HEATING"
    },
    Values: {
      type: 'object',
      additionalProperties: {
          type: "string",
          description: "Map with name-value pairs"
      },
      description: "Map with name-value pairs"
    },
    EstateDesignationId: {
      type: 'object',
      properties: {
        designation: {
          description: 'The designation of the estate.',
          type: 'string'
        },
        objectidentifier: {
          description: 'The unique identifier of the estate.',
          type: 'string'
        }
      }
    },
    EstateAddressId: {
      type: 'object',
      properties: {
        designation: {
          description: 'The adress of the estate.',
          type: 'string'
        },
        objectidentifier: {
          description: 'The unique identifier of the estate.',
          type: 'string'
        }
      }
    },
    EstateData: {
      type: 'object',
      properties: {
        designation: {
          description: 'The designation of the estate.',
          type: 'string'
        },
        objectidentifier: {
          description: 'The unique identifier of the estate.',
          type: 'string'
        },
        ownership: {
          description: 'The current ownership of the estate.',
          type: 'array',
          items: {
            "$ref": "#/definitions/TitleDeed"
          }
        },
        previousOwnership: {
          description: 'The previous ownerships of the estate.',
          type: 'array',
          items: {
            "$ref": "#/definitions/TitleDeed"
          }
        },
        ownerChanges: {
          description: 'The changes of owning of estate.',
          type: 'array',
          items: {
            "$ref": "#/definitions/OwnerChanges"
          }
        },
        actions: {
          description: 'The actions performed on the estate.',
          type: 'array',
          items: {
            "$ref": "#/definitions/Actions"
          }
        }
      }
    },
    TitleDeed: {
      type: 'object',
      properties: {
        type: {
          description: 'Type of ownership.',
          type: 'string'
        },
        objectidentifier: {
          description: 'The unique identifier of the ownership.',
          type: 'string'
        },
        enrollmentDay: {
          description: 'The date of enrollment.',
          type: 'string'
        },
        decision: {
          description: 'The decision of the ownership.',
          type: 'string'
        },
        share: {
          description: 'The share of ownership.',
          type: 'string'
        },
        diaryNumber: {
          description: 'References to dairy.',
          type: 'array',
          items: {
            type: "string"
          }
        },
        versionValidFrom: {
          description: 'From when the ownership is valid.',
          type: 'string'
        },
        owner: {
          description: 'The owners of a estate.',
          type: 'object',
          properties: {
            idnumber: {
              description: 'The id number of owner i.e. organisation number or person number.',
              type: 'string'
            },
            name: {
              description: 'The name of owner person or organisation.',
              type: 'string'
            }
          }
        }
      }
    },
    OwnerChanges: {
      type: 'object',
      properties: {
        objectidentifier: {
          description: 'The unique identifier of the ownership.',
          type: 'string'
        },
        acquisition: {
          description: 'The acquisition.',
          type: 'array',
          items: {
            "$ref": "#/definitions/Acquisition"
          }
        },
        purchasePrice: {
          description: 'The price of the purchase.',
          type: 'object',
          properties: {
            objectidentifier: {
              description: 'The unique identifier of the purchase price.',
              type: 'string'
            },
            purchasePriceType: {
              description: 'The type of the purchase.',
              type: 'string'
            }
          }
        },
        transfer: {
          description: 'The transfer of a acquisition.',
          type: 'array',
          items: {
            "$ref": "#/definitions/Transfer"
          }
        }
      }
    },
    Acquisition: {
      type: 'object',
      properties: {
        objectidentifier: {
          description: 'The unique identifier of the acquisition.',
          type: 'string'
        },
        enrollmentDay: {
          description: 'The enrollment day of the acquisition.',
          type: 'string'
        },
        decision: {
          description: 'The decision of the acquisition.',
          type: 'string'
        },
        share: {
          description: 'The share of the acquisition.',
          type: 'string'
        },
        acquisitionDay: {
          description: 'The day of the acquisition.',
          type: 'string'
        },
        acquisitionType: {
          description: 'The type of the acquisition.',
          type: 'string'
        },
        registeredOwnership: {
          description: 'The unique identifier of the registered ownership.',
          type: 'string'
        }
      }
    },
    Transfer: {
      type: 'object',
      properties: {
        objectidentifier: {
          description: 'The unique identifier of the acquisition.',
          type: 'string'
        },
        share: {
          description: 'The share of the acquisition.',
          type: 'string'
        },
        registeredOwnership: {
          description: 'The unique identifier of the registered ownership.',
          type: 'string'
        }
      }
    },
    Actions: {
      type: 'object',
      properties: {
        actionType1: {
          description: 'The first type of an action.',
          type: 'string'
        },
        actionType2: {
          description: 'The second type of an action.',
          type: 'string'
        },
        fileDesignation: {
          description: 'The designation of the file of the action.',
          type: 'string'
        },
        actionDate: {
          description: 'The date of when the action is performed.',
          type: 'string'
        },
        objectidentifier: {
          description: 'The unique identifier of the action.',
          type: 'string'
        },
        littera: {
          description: 'Reference to estate in the action.',
          type: 'string'
        },
        runningNumber: {
          description: 'A number showing in which order the actions is performed.',
          type: 'string'
        }
      }
    }
  },

  // paths are derived from args.routes.  These are filled in by fs-routes.
  paths: {},
};
