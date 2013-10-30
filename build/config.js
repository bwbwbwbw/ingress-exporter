(function() {
  var Config;

  Config = GLOBAL.Config = {
    Auth: {
      CookieRaw: 'GOOGAPPUID=45; csrftoken=cfyuOEvLN8oXmx5CFuwJqsCcYj1svvOR; ACSID=AJKiYcGvnyXCTvnfx2_8EuxtIqNOT1yoUwCwkNqHbjso-5IeILFLTaFvkPq4NIJNx11QyKvGJb2xAnvoLHa4shfp3kgndQvSWOkRSPTRfVcTaV-dicVzvXTW8wy1Ieob23vtQMyL3FrIT7-MLxS5N0ZlRPjBKOkTbvXv7ZMfsE4fhwcCUegS9crCikKcy2LhECydtA-0q0zktqyUzD6aMIlr_t02nOlCvFxYPn9GQDiYWFFxvmr2jt1WIizUfFj7tHbfnyottCFhp9mdZUgIH2J5F_kIWiRhpLHTzFwpRMhLJyk9eFuoa9p_6RjcUCQ7fnOjRA2w-JBww-y1LjyQjJtuq4oBMEIyTymymVtdHLlGZ-84nDRhuPN_8itSqFH01pXd65ouvf7Ps2QJxMslPiE81qRs0b9YBHAWw6fNMdS3nT2xgMv0qXOXTigJyuZMRJKsFQooBbXP87kgTwEo2q2WDi0862dAQeexSDfjf9gHMIByoHu33OG4U3XF2GOYro4ZPhHOQkxymhqddcBuz_iGqqrIhdnLz00JfFFO53A0AO6GOqcDuwf3ckJJceb6wFP55KmTLJw8;'
    },
    MinPortalLevel: 0,
    Region: {
      NorthEast: {
        Lat: 31.620154,
        Lng: 121.955604
      },
      SouthWest: {
        Lat: 30.720934,
        Lng: 120.908979
      }
    },
    Request: {
      MaxParallel: 5
    },
    Tile: {
      MaxFailRetry: 3,
      MaxErrorRetry: 3,
      TimeoutDelay: 500,
      FailDelay: 4000
    },
    TileBucket: {
      Max: 4,
      Min: 4
    },
    Database: {
      ConnectString: 'localhost:27017/ingress?auto_reconnect',
      Options: {
        safe: true
      }
    },
    Munges: {
      ActiveSet: 2,
      Data: [
        {
          'dashboard.getGameScore': 'fhlzntzkl5v7hcfh',
          'dashboard.getPaginatedPlextsV2': 'wzuitnswoda7w028',
          'dashboard.getThinnedEntitiesV4': 'scgrm4lf2371esgw',
          'dashboard.getPlayersByGuids': '81l6usczczoi3lfi',
          'dashboard.redeemReward': '8kop2koeld9b4c26',
          'dashboard.sendInviteEmail': 't0ccodsm1nuo5uso',
          'dashboard.sendPlext': 'k04cfjwwsg3h3827',
          method: '22ux2z96jwq5zn78',
          version: 'kf6hgl9yau03ws0o',
          version_parameter: '4608f4356a6f55690f127fb542f557f98de66169',
          boundsParamsList: '29t16cmsn6l3r2xg',
          id: '7rogqhp5pzcqobcw',
          minLatE6: 'yzbnp7z9bd28p0yr',
          minLngE6: '2pdhntvo85cd90bw',
          maxLatE6: 'c4ivr013h4dr68pd',
          maxLngE6: '4p8oorcrwalc1mzf',
          timestampMs: 'vd2rsa9v6f8q606s',
          qk: 'cblh9xe0bgwjy5ij',
          desiredNumItems: '3ymaq7slb165porj',
          minTimestampMs: 's9jf2seni33y3gyu',
          maxTimestampMs: '2kh3vti98rhp3g29',
          chatTab: '7n7ocqfq1p18352b',
          ascendingTimestampOrder: 'p88a2ztchtjhiazl',
          message: 'e8qm0kptw2trrcrw',
          latE6: 'fja1phtsqxm71dqm',
          lngE6: 'iut1tb7c0x726hwn',
          guids: '5hyiwhwc0jyljvro',
          inviteeEmailAddress: 's9z6zt03eymzxhkj'
        }, {
          'dashboard.getGameScore': 'ija9jgrf5hj7wm9r',
          'dashboard.getPaginatedPlextsV2': '0elftx739mkbzi1b',
          'dashboard.getThinnedEntitiesV4': 'prv0ez8cbsykh63g',
          'dashboard.getPlayersByGuids': 'i0lxy6nc695z9ka3',
          'dashboard.redeemReward': '376oivna8rf8qbfj',
          'dashboard.sendInviteEmail': '96y930v5q96nrcrw',
          'dashboard.sendPlext': 'c04kceytofuqvyqg',
          method: '9we4b31i48ui4sdm',
          version: 'q402kn5zqisuo1ym',
          version_parameter: 'dbad4485024d446ae946e3d287b5d640029ef3e3',
          boundsParamsList: '3r5ctyvc2f653zjd',
          id: 'izey8ciqg2dz2oqc',
          minLatE6: 'cein0n4jrifa7ui2',
          minLngE6: 'lbd1juids3johtdo',
          maxLatE6: 'h4kyot9kmvd3g284',
          maxLngE6: 'sbci6jjc2d5g9uy4',
          timestampMs: '2wurn9giagbvv6bt',
          qk: 'hq73mwpjqyvcp6ul',
          desiredNumItems: 'kyo6vh5n58hmrnua',
          minTimestampMs: 'hu4swdftcp7mvkdi',
          maxTimestampMs: 'ly6ylae5lv1z9072',
          chatTab: 'q5kxut5rmbtlqbf9',
          ascendingTimestampOrder: 'hvfd0io35rahwjgr',
          message: 'z4hf7tzl27o14455',
          latE6: 'zyzh3bdxyd47vk1x',
          lngE6: 'n5d1f8pql51t641x',
          guids: 'gl16ehqoc3i3oi07',
          inviteeEmailAddress: 'orc9ufg7rp7g1y9j'
        }, {
          'dashboard.getGameScore': '3b48kl956b33brrl',
          'dashboard.getPaginatedPlextsV2': 'h785pmet6wrx6xoa',
          'dashboard.getThinnedEntitiesV4': '4gux7b0n3euu7e8y',
          'dashboard.getPlayersByGuids': 'nqm1kocgzspecpzv',
          'dashboard.redeemReward': 'g618n6peb74u2ae9',
          'dashboard.sendInviteEmail': 'bsl4280bm39bkl3a',
          'dashboard.sendPlext': 'jym2hbw15i6uru7g',
          method: 'g9cmy5g6vpxpmcxz',
          version: 'blq7574e6kkg0fig',
          version_parameter: '465c62b22b3bc9ecae01e08b30703752186a1dc9',
          boundsParamsList: '45k478vh10jt1ik7',
          id: '3eh1ynwxjy8c8rd5',
          minLatE6: 'krpywcgq1voq71z3',
          minLngE6: 'yo6lte88zvoneqi6',
          maxLatE6: 'dncli54tfafmtk6y',
          maxLngE6: '76pq437r7vm3osx9',
          timestampMs: '2zlgpsg1x6i9720s',
          qk: 'pzejivoj28p6kkry',
          desiredNumItems: 'u3uxpkqd4pn37ydn',
          minTimestampMs: 'msw5gcxhuuk46rb2',
          maxTimestampMs: 'bps0ekgdzakdfvr0',
          chatTab: 'pm4fm8bjvotjm30h',
          ascendingTimestampOrder: '7qp8gv50ogelh7cs',
          message: 'y599irwyfs45adp4',
          latE6: '19ko11fmx32sjfqk',
          lngE6: 'i8yjq6v2mjhze29d',
          guids: 'szebfshb9f3uo2h9',
          inviteeEmailAddress: 'qq4t7lhqphq7wqvh'
        }
      ]
    }
  };

}).call(this);
